/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPInternal.h"
#include "nsLDAPMessage.h"
#include "nspr.h"
#include "nsDebug.h"
#include "nsMemory.h"
#include "nsLDAPConnection.h"
#include "nsISupportsUtils.h"
#include "nsLDAPBERValue.h"
#include "nsILDAPErrors.h"
#include "nsIClassInfoImpl.h"
#include "nsLDAPUtils.h"

NS_IMPL_CLASSINFO(nsLDAPMessage, NULL, nsIClassInfo::THREADSAFE,
                  NS_LDAPMESSAGE_CID)

NS_IMPL_ADDREF(nsLDAPMessage)
NS_IMPL_RELEASE(nsLDAPMessage)
NS_INTERFACE_MAP_BEGIN(nsLDAPMessage)
  NS_INTERFACE_MAP_ENTRY(nsILDAPMessage)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsILDAPMessage)
  NS_IMPL_QUERY_CLASSINFO(nsLDAPMessage)
NS_INTERFACE_MAP_END
NS_IMPL_CI_INTERFACE_GETTER(nsLDAPMessage, nsILDAPMessage)


// constructor
//
nsLDAPMessage::nsLDAPMessage()
    : mMsgHandle(0),
      mErrorCode(LDAP_SUCCESS),
      mMatchedDn(0),
      mErrorMessage(0),
      mReferrals(0),
      mServerControls(0)
{
}

// destructor
//
nsLDAPMessage::~nsLDAPMessage(void)
{
    if (mMsgHandle) {
        int rc = ldap_msgfree(mMsgHandle);

// If you are having problems compiling the following code on a Solaris
// machine with the Forte 6 Update 1 compilers, then you need to make
// sure you have applied all the required patches. See:
// http://www.mozilla.org/unix/solaris-build.html for more details.

        switch(rc) {
        case LDAP_RES_BIND:
        case LDAP_RES_SEARCH_ENTRY:
        case LDAP_RES_SEARCH_RESULT:
        case LDAP_RES_MODIFY:
        case LDAP_RES_ADD:
        case LDAP_RES_DELETE:
        case LDAP_RES_MODRDN:
        case LDAP_RES_COMPARE:
        case LDAP_RES_SEARCH_REFERENCE:
        case LDAP_RES_EXTENDED:
        case LDAP_RES_ANY:
            // success
            break;

        case LDAP_SUCCESS:
            // timed out (dunno why LDAP_SUCCESS is used to indicate this)
            MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Warning,
                   ("nsLDAPMessage::~nsLDAPMessage: ldap_msgfree() "
                    "timed out\n"));
            break;

        default:
            // other failure
            MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Warning,
                   ("nsLDAPMessage::~nsLDAPMessage: ldap_msgfree() "
                    "failed: %s\n", ldap_err2string(rc)));
            break;
        }
    }

    if (mMatchedDn) {
        ldap_memfree(mMatchedDn);
    }

    if (mErrorMessage) {
        ldap_memfree(mErrorMessage);
    }

    if (mReferrals) {
        ldap_value_free(mReferrals);
    }

    if (mServerControls) {
        ldap_controls_free(mServerControls);
    }

}

/**
 * Initializes a message.
 *
 * @param aConnection           The nsLDAPConnection this message is on
 * @param aMsgHandle            The native LDAPMessage to be wrapped.
 *
 * @exception NS_ERROR_ILLEGAL_VALUE        null pointer passed in
 * @exception NS_ERROR_UNEXPECTED           internal err; shouldn't happen
 * @exception NS_ERROR_LDAP_DECODING_ERROR  problem during BER decoding
 * @exception NS_ERROR_OUT_OF_MEMORY        ran out of memory
 */
nsresult
nsLDAPMessage::Init(nsILDAPConnection *aConnection, LDAPMessage *aMsgHandle)
{
    int parseResult;

    if (!aConnection || !aMsgHandle) {
        NS_WARNING("Null pointer passed in to nsLDAPMessage::Init()");
        return NS_ERROR_ILLEGAL_VALUE;
    }

    // initialize the appropriate member vars
    //
    mConnection = aConnection;
    mMsgHandle = aMsgHandle;

    // cache the connection handle.  we're violating the XPCOM type-system
    // here since we're a friend of the connection class and in the
    // same module.
    //
    mConnectionHandle = static_cast<nsLDAPConnection *>(aConnection)->mConnectionHandle;

    // do any useful message parsing
    //
    const int msgType = ldap_msgtype(mMsgHandle);
    if ( msgType == -1) {
        NS_ERROR("nsLDAPMessage::Init(): ldap_msgtype() failed");
        return NS_ERROR_UNEXPECTED;
    }

    switch (msgType) {

    case LDAP_RES_SEARCH_REFERENCE:
        // XXX should do something here?
        break;

    case LDAP_RES_SEARCH_ENTRY:
        // nothing to do here
        break;

    case LDAP_RES_EXTENDED:
        // XXX should do something here?
        break;

    case LDAP_RES_BIND:
    case LDAP_RES_SEARCH_RESULT:
    case LDAP_RES_MODIFY:
    case LDAP_RES_ADD:
    case LDAP_RES_DELETE:
    case LDAP_RES_MODRDN:
    case LDAP_RES_COMPARE:
        parseResult = ldap_parse_result(mConnectionHandle,
                                        mMsgHandle, &mErrorCode, &mMatchedDn,
                                        &mErrorMessage,&mReferrals,
                                        &mServerControls, 0);
        switch (parseResult) {
        case LDAP_SUCCESS:
            // we're good
            break;

        case LDAP_DECODING_ERROR:
            NS_WARNING("nsLDAPMessage::Init(): ldap_parse_result() hit a "
                       "decoding error");
            return NS_ERROR_LDAP_DECODING_ERROR;

        case LDAP_NO_MEMORY:
            NS_WARNING("nsLDAPMessage::Init(): ldap_parse_result() ran out "
                       "of memory");
            return NS_ERROR_OUT_OF_MEMORY;

        case LDAP_PARAM_ERROR:
        case LDAP_MORE_RESULTS_TO_RETURN:
        case LDAP_NO_RESULTS_RETURNED:
        default:
            NS_ERROR("nsLDAPMessage::Init(): ldap_parse_result returned "
                     "unexpected return code");
            return NS_ERROR_UNEXPECTED;
        }

        break;

    default:
        NS_ERROR("nsLDAPMessage::Init(): unexpected message type");
        return NS_ERROR_UNEXPECTED;
    }

    return NS_OK;
}

/**
 * The result code of the (possibly partial) operation.
 *
 * @exception NS_ERROR_ILLEGAL_VALUE    null pointer passed in
 *
 * readonly attribute long errorCode;
 */
NS_IMETHODIMP
nsLDAPMessage::GetErrorCode(int32_t *aErrorCode)
{
    if (!aErrorCode) {
        return NS_ERROR_ILLEGAL_VALUE;
    }

    *aErrorCode = mErrorCode;
    return NS_OK;
}

NS_IMETHODIMP
nsLDAPMessage::GetType(int32_t *aType)
{
    if (!aType) {
        return NS_ERROR_ILLEGAL_VALUE;
    }

    *aType = ldap_msgtype(mMsgHandle);
    if (*aType == -1) {
        return NS_ERROR_UNEXPECTED;
    };

    return NS_OK;
}

// we don't get to use exceptions, so we'll fake it.  this is an error
// handler for IterateAttributes().
//
nsresult
nsLDAPMessage::IterateAttrErrHandler(int32_t aLderrno, uint32_t *aAttrCount,
                                     char** *aAttributes, BerElement *position)
{

    // if necessary, free the position holder used by
    // ldap_{first,next}_attribute()
    //
    if (position) {
        ldap_ber_free(position, 0);
    }

    // deallocate any entries in the array that have been allocated, then
    // the array itself
    //
    if (*aAttributes) {
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(*aAttrCount, *aAttributes);
    }

    // possibly spit out a debugging message, then return an appropriate
    // error code
    //
    switch (aLderrno) {

    case LDAP_PARAM_ERROR:
        NS_WARNING("nsLDAPMessage::IterateAttributes() failure; probable bug "
                   "or memory corruption encountered");
        return NS_ERROR_UNEXPECTED;
        break;

    case LDAP_DECODING_ERROR:
        NS_WARNING("nsLDAPMessage::IterateAttributes(): decoding error");
        return NS_ERROR_LDAP_DECODING_ERROR;
        break;

    case LDAP_NO_MEMORY:
        return NS_ERROR_OUT_OF_MEMORY;
        break;

    }

    NS_WARNING("nsLDAPMessage::IterateAttributes(): LDAP C SDK returned "
               "unexpected value; possible bug or memory corruption");
    return NS_ERROR_UNEXPECTED;
}


// wrapper for ldap_first_attribute
//
NS_IMETHODIMP
nsLDAPMessage::GetAttributes(uint32_t *aAttrCount, char** *aAttributes)
{
    return IterateAttributes(aAttrCount, aAttributes, true);
}

// if getP is true, we get the attributes by recursing once
// (without getP set) in order to fill in *attrCount, then allocate
// and fill in the *aAttributes.
//
// if getP is false, just fill in *attrCount and return
//
nsresult
nsLDAPMessage::IterateAttributes(uint32_t *aAttrCount, char** *aAttributes,
                 bool getP)
{
    BerElement *position;
    nsresult rv;

    if (!aAttrCount || !aAttributes ) {
        return NS_ERROR_INVALID_POINTER;
    }

    // if we've been called from GetAttributes, recurse once in order to
    // count the elements in this message.
    //
    if (getP) {
        *aAttributes = 0;
        *aAttrCount = 0;

        rv = IterateAttributes(aAttrCount, aAttributes, false);
        if (NS_FAILED(rv))
            return rv;

        // create an array of the appropriate size
        //
        *aAttributes = static_cast<char **>(moz_xmalloc(*aAttrCount *
                                                      sizeof(char *)));
        if (!*aAttributes) {
            return NS_ERROR_OUT_OF_MEMORY;
        }
    }

    // get the first attribute
    //
    char *attr = ldap_first_attribute(mConnectionHandle,
                                      mMsgHandle,
                                      &position);
    if (!attr) {
        return IterateAttrErrHandler(ldap_get_lderrno(mConnectionHandle, 0, 0),
                                     aAttrCount, aAttributes, position);
    }

    // if we're getting attributes, try and fill in the first field
    //
    if (getP) {
        (*aAttributes)[0] = NS_strdup(attr);
        if (!(*aAttributes)[0]) {
            ldap_memfree(attr);
            free(*aAttributes);
            return NS_ERROR_OUT_OF_MEMORY;
        }

        // note that we start counting again, in order to keep our place in
        // the array so that we can unwind gracefully and avoid leakage if
        // we hit an error as we're filling in the array
        //
        *aAttrCount = 1;
    } else {

        // otherwise just update the count
        //
        *aAttrCount = 1;
    }
    ldap_memfree(attr);

    while (1) {

        // get the next attribute
        //
        attr = ldap_next_attribute(mConnectionHandle, mMsgHandle, position);

        // check to see if there is an error, or if we're just done iterating
        //
        if (!attr) {

            // bail out if there's an error
            //
            int32_t lderrno = ldap_get_lderrno(mConnectionHandle, 0, 0);
            if (lderrno != LDAP_SUCCESS) {
                return IterateAttrErrHandler(lderrno, aAttrCount, aAttributes,
                                             position);
            }

            // otherwise, there are no more attributes; we're done with
            // the while loop
            //
            break;

        } else if (getP) {

            // if ldap_next_attribute did return successfully, and
            // we're supposed to fill in a value, do so.
            //
            (*aAttributes)[*aAttrCount] = NS_strdup(attr);
            if (!(*aAttributes)[*aAttrCount]) {
                ldap_memfree(attr);
                return IterateAttrErrHandler(LDAP_NO_MEMORY, aAttrCount,
                                             aAttributes, position);
            }

        }
        ldap_memfree(attr);

        // we're done using *aAttrCount as a c-style array index (ie starting
        // at 0).  update it to reflect the number of elements now in the array
        //
        *aAttrCount += 1;
    }

    // free the position pointer, if necessary
    //
    if (position) {
        ldap_ber_free(position, 0);
    }

    return NS_OK;
}

// readonly attribute wstring dn;
NS_IMETHODIMP nsLDAPMessage::GetDn(nsACString& aDn)
{
    char *rawDn = ldap_get_dn(mConnectionHandle, mMsgHandle);

    if (!rawDn) {
        int32_t lderrno = ldap_get_lderrno(mConnectionHandle, 0, 0);

        switch (lderrno) {

        case LDAP_DECODING_ERROR:
            NS_WARNING("nsLDAPMessage::GetDn(): ldap decoding error");
            return NS_ERROR_LDAP_DECODING_ERROR;

        case LDAP_PARAM_ERROR:
        default:
            NS_ERROR("nsLDAPMessage::GetDn(): internal error");
            return NS_ERROR_UNEXPECTED;
        }
    }

    MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Debug,
           ("nsLDAPMessage::GetDn(): dn = '%s'", rawDn));

    aDn.Assign(rawDn);
    ldap_memfree(rawDn);

    return NS_OK;
}

// wrapper for ldap_get_values()
//
NS_IMETHODIMP
nsLDAPMessage::GetValues(const char *aAttr, uint32_t *aCount,
                         char16_t ***aValues)
{
    char **values;

#if defined(DEBUG)
    // We only want this being logged for debug builds so as not to affect performance too much.
    MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Debug,
           ("nsLDAPMessage::GetValues(): called with aAttr = '%s'", aAttr));
#endif

    values = ldap_get_values(mConnectionHandle, mMsgHandle, aAttr);

    // bail out if there was a problem
    //
    if (!values) {
        int32_t lderrno = ldap_get_lderrno(mConnectionHandle, 0, 0);

        if ( lderrno == LDAP_DECODING_ERROR ) {
            // this may not be an error; it could just be that the
            // caller has asked for an attribute that doesn't exist.
            //
            MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Warning,
                   ("nsLDAPMessage::GetValues(): ldap_get_values returned "
                    "LDAP_DECODING_ERROR"));
            return NS_ERROR_LDAP_DECODING_ERROR;

        } else if ( lderrno == LDAP_PARAM_ERROR ) {
            NS_ERROR("nsLDAPMessage::GetValues(): internal error: 1");
            return NS_ERROR_UNEXPECTED;

        } else {
            NS_ERROR("nsLDAPMessage::GetValues(): internal error: 2");
            return NS_ERROR_UNEXPECTED;
        }
    }

    // count the values
    //
    uint32_t numVals = ldap_count_values(values);

    // create an array of the appropriate size
    //
    *aValues = static_cast<char16_t **>(moz_xmalloc(numVals * sizeof(char16_t *)));
    if (!*aValues) {
        ldap_value_free(values);
        return NS_ERROR_OUT_OF_MEMORY;
    }

    // clone the array (except for the trailing NULL entry) using the
    // shared allocator for XPCOM correctness
    //
    uint32_t i;
    for ( i = 0 ; i < numVals ; i++ ) {
        nsDependentCString sValue(values[i]);
        if (IsUTF8(sValue))
            (*aValues)[i] = ToNewUnicode(NS_ConvertUTF8toUTF16(sValue));
        else
            (*aValues)[i] = ToNewUnicode(NS_ConvertASCIItoUTF16(sValue));
        if ( ! (*aValues)[i] ) {
            NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(i, aValues);
            ldap_value_free(values);
            return NS_ERROR_OUT_OF_MEMORY;
        }
    }

    // now free our value array since we already cloned the values array
    // to the 'aValues' results array.
    ldap_value_free(values);

    *aCount = numVals;
    return NS_OK;
}

// wrapper for get_values_len
//
NS_IMETHODIMP
nsLDAPMessage::GetBinaryValues(const char *aAttr, uint32_t *aCount,
                               nsILDAPBERValue ***aValues)
{
    struct berval **values;

#if defined(DEBUG)
    // We only want this being logged for debug builds so as not to affect performance too much.
    MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Debug,
           ("nsLDAPMessage::GetBinaryValues(): called with aAttr = '%s'",
            aAttr));
#endif

    values = ldap_get_values_len(mConnectionHandle, mMsgHandle, aAttr);

    // bail out if there was a problem
    //
    if (!values) {
        int32_t lderrno = ldap_get_lderrno(mConnectionHandle, 0, 0);

        if ( lderrno == LDAP_DECODING_ERROR ) {
            // this may not be an error; it could just be that the
            // caller has asked for an attribute that doesn't exist.
            //
            MOZ_LOG(gLDAPLogModule, mozilla::LogLevel::Warning,
                   ("nsLDAPMessage::GetBinaryValues(): ldap_get_values "
                    "returned LDAP_DECODING_ERROR"));
            return NS_ERROR_LDAP_DECODING_ERROR;

        } else if ( lderrno == LDAP_PARAM_ERROR ) {
            NS_ERROR("nsLDAPMessage::GetBinaryValues(): internal error: 1");
            return NS_ERROR_UNEXPECTED;

        } else {
            NS_ERROR("nsLDAPMessage::GetBinaryValues(): internal error: 2");
            return NS_ERROR_UNEXPECTED;
        }
    }

    // count the values
    //
    uint32_t numVals = ldap_count_values_len(values);

    // create the out array
    //
    *aValues =
        static_cast<nsILDAPBERValue **>(moz_xmalloc(numVals * sizeof(nsILDAPBERValue)));
    if (!aValues) {
        ldap_value_free_len(values);
        return NS_ERROR_OUT_OF_MEMORY;
    }

    // clone the array (except for the trailing NULL entry) using the
    // shared allocator for XPCOM correctness
    //
    uint32_t i;
    nsresult rv;
    for ( i = 0 ; i < numVals ; i++ ) {

        // create an nsBERValue object
        //
        nsCOMPtr<nsILDAPBERValue> berValue = new nsLDAPBERValue();
        if (!berValue) {
            NS_ERROR("nsLDAPMessage::GetBinaryValues(): out of memory"
                     " creating nsLDAPBERValue object");
            NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(i, aValues);
            ldap_value_free_len(values);
            return NS_ERROR_OUT_OF_MEMORY;
        }

        // copy the value from the struct into the nsBERValue
        //
        rv = berValue->Set(values[i]->bv_len,
                           reinterpret_cast<uint8_t *>(values[i]->bv_val));
        if (NS_FAILED(rv)) {
            NS_ERROR("nsLDAPMessage::GetBinaryValues(): error setting"
                     " nsBERValue");
            ldap_value_free_len(values);
            return rv == NS_ERROR_OUT_OF_MEMORY ? rv : NS_ERROR_UNEXPECTED;
        }

        // put the nsIBERValue object into the out array
        //
        NS_ADDREF( (*aValues)[i] = berValue.get() );
    }

    *aCount = numVals;
    ldap_value_free_len(values);
    return NS_OK;
}

// readonly attribute nsILDAPOperation operation;
NS_IMETHODIMP nsLDAPMessage::GetOperation(nsILDAPOperation **_retval)
{
    if (!_retval) {
        NS_ERROR("nsLDAPMessage::GetOperation: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    NS_IF_ADDREF(*_retval = mOperation);
    return NS_OK;
}

NS_IMETHODIMP
nsLDAPMessage::ToUnicode(char16_t* *aString)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsLDAPMessage::GetErrorMessage(nsACString & aErrorMessage)
{
    aErrorMessage.Assign(mErrorMessage);
    return NS_OK;
}

NS_IMETHODIMP
nsLDAPMessage::GetMatchedDn(nsACString & aMatchedDn)
{
    aMatchedDn.Assign(mMatchedDn);
    return NS_OK;
}
