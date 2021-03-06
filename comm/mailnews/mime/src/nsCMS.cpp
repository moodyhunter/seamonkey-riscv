/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCMS.h"

#include "CertVerifier.h"
#include "CryptoTask.h"
#include "ScopedNSSTypes.h"
#include "cms.h"
#include "mozilla/Logging.h"
#include "mozilla/RefPtr.h"
#include "nsArrayUtils.h"
#include "nsDependentSubstring.h"
#include "nsIArray.h"
#include "nsICMSMessageErrors.h"
#include "nsICryptoHash.h"
#include "nsISupports.h"
#include "nsIX509CertDB.h"
#include "nsNSSCertificate.h"
#include "nsNSSComponent.h"
#include "nsNSSHelper.h"
#include "nsServiceManagerUtils.h"
#include "mozpkix/Result.h"
#include "mozpkix/pkixtypes.h"
#include "secerr.h"
#include "smime.h"
#include "mozilla/StaticMutex.h"

using namespace mozilla;
using namespace mozilla::psm;
using namespace mozilla::pkix;

extern mozilla::LazyLogModule gPIPNSSLog;

NS_IMPL_ISUPPORTS(nsCMSMessage, nsICMSMessage, nsICMSMessage2)

nsCMSMessage::nsCMSMessage()
{
  m_cmsMsg = nullptr;
}
nsCMSMessage::nsCMSMessage(NSSCMSMessage *aCMSMsg)
{
  m_cmsMsg = aCMSMsg;
}

nsCMSMessage::~nsCMSMessage()
{
  if (m_cmsMsg) {
    NSS_CMSMessage_Destroy(m_cmsMsg);
  }
}

nsresult nsCMSMessage::Init()
{
  nsresult rv;
  nsCOMPtr<nsISupports> nssInitialized = do_GetService("@mozilla.org/psm;1", &rv);
  return rv;
}

NS_IMETHODIMP nsCMSMessage::VerifySignature()
{
  return CommonVerifySignature(nullptr, 0);
}

NSSCMSSignerInfo* nsCMSMessage::GetTopLevelSignerInfo()
{
  if (!m_cmsMsg)
    return nullptr;

  if (!NSS_CMSMessage_IsSigned(m_cmsMsg))
    return nullptr;

  NSSCMSContentInfo *cinfo = NSS_CMSMessage_ContentLevel(m_cmsMsg, 0);
  if (!cinfo)
    return nullptr;

  NSSCMSSignedData *sigd = (NSSCMSSignedData*)NSS_CMSContentInfo_GetContent(cinfo);
  if (!sigd)
    return nullptr;

  PR_ASSERT(NSS_CMSSignedData_SignerInfoCount(sigd) > 0);
  return NSS_CMSSignedData_GetSignerInfo(sigd, 0);
}

NS_IMETHODIMP nsCMSMessage::GetSignerEmailAddress(char * * aEmail)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::GetSignerEmailAddress\n"));
  NS_ENSURE_ARG(aEmail);

  NSSCMSSignerInfo *si = GetTopLevelSignerInfo();
  if (!si)
    return NS_ERROR_FAILURE;

  *aEmail = NSS_CMSSignerInfo_GetSignerEmailAddress(si);
  return NS_OK;
}

NS_IMETHODIMP nsCMSMessage::GetSignerCommonName(char ** aName)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::GetSignerCommonName\n"));
  NS_ENSURE_ARG(aName);

  NSSCMSSignerInfo *si = GetTopLevelSignerInfo();
  if (!si)
    return NS_ERROR_FAILURE;

  *aName = NSS_CMSSignerInfo_GetSignerCommonName(si);
  return NS_OK;
}

NS_IMETHODIMP nsCMSMessage::ContentIsEncrypted(bool *isEncrypted)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::ContentIsEncrypted\n"));
  NS_ENSURE_ARG(isEncrypted);

  if (!m_cmsMsg)
    return NS_ERROR_FAILURE;

  *isEncrypted = NSS_CMSMessage_IsEncrypted(m_cmsMsg);

  return NS_OK;
}

NS_IMETHODIMP nsCMSMessage::ContentIsSigned(bool *isSigned)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::ContentIsSigned\n"));
  NS_ENSURE_ARG(isSigned);

  if (!m_cmsMsg)
    return NS_ERROR_FAILURE;

  *isSigned = NSS_CMSMessage_IsSigned(m_cmsMsg);

  return NS_OK;
}

NS_IMETHODIMP nsCMSMessage::GetSignerCert(nsIX509Cert **scert)
{
  NSSCMSSignerInfo *si = GetTopLevelSignerInfo();
  if (!si)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIX509Cert> cert;
  if (si->cert) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::GetSignerCert got signer cert\n"));

    nsCOMPtr<nsIX509CertDB> certdb = do_GetService(NS_X509CERTDB_CONTRACTID);
    nsDependentCSubstring certDER(
      reinterpret_cast<char*>(si->cert->derCert.data),
      si->cert->derCert.len);
    nsresult rv = certdb->ConstructX509(certDER, getter_AddRefs(cert));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::GetSignerCert no signer cert, do we have a cert list? %s\n",
      (si->certList ? "yes" : "no") ));

    *scert = nullptr;
  }

  cert.forget(scert);

  return NS_OK;
}

NS_IMETHODIMP nsCMSMessage::GetEncryptionCert(nsIX509Cert**)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsCMSMessage::VerifyDetachedSignature(unsigned char* aDigestData, uint32_t aDigestDataLen)
{
  if (!aDigestData || !aDigestDataLen)
    return NS_ERROR_FAILURE;

  return CommonVerifySignature(aDigestData, aDigestDataLen);
}

// This is an exact copy of NSS_CMSArray_Count from NSS' cmsarray.c,
// temporarily necessary, see below for for justification.
static int myNSS_CMSArray_Count(void** array) {
  int n = 0;

  if (array == NULL) return 0;

  while (*array++ != NULL) n++;

  return n;
}

// This is an exact copy of NSS_CMSArray_Add from NSS' cmsarray.c,
// temporarily necessary, see below for for justification.
static SECStatus myNSS_CMSArray_Add(PLArenaPool* poolp, void*** array,
                                    void* obj) {
  void** p;
  int n;
  void** dest;

  PORT_Assert(array != NULL);
  if (array == NULL) return SECFailure;

  if (*array == NULL) {
    dest = (void**)PORT_ArenaAlloc(poolp, 2 * sizeof(void*));
    n = 0;
  } else {
    n = 0;
    p = *array;
    while (*p++) n++;
    dest = (void**)PORT_ArenaGrow(poolp, *array, (n + 1) * sizeof(void*),
                                  (n + 2) * sizeof(void*));
  }

  if (dest == NULL) return SECFailure;

  dest[n] = obj;
  dest[n + 1] = NULL;
  *array = dest;
  return SECSuccess;
}

// This is an exact copy of NSS_CMSArray_Add from NSS' cmsarray.c,
// temporarily necessary, see below for for justification.
static SECStatus myNSS_CMSSignedData_AddTempCertificate(NSSCMSSignedData* sigd,
                                                        CERTCertificate* cert) {
  CERTCertificate* c;
  SECStatus rv;

  if (!sigd || !cert) {
    PORT_SetError(SEC_ERROR_INVALID_ARGS);
    return SECFailure;
  }

  c = CERT_DupCertificate(cert);
  rv = myNSS_CMSArray_Add(sigd->cmsg->poolp, (void***)&(sigd->tempCerts),
                          (void*)c);
  return rv;
}

typedef SECStatus (*extraVerificationOnCertFn)(CERTCertificate* cert,
                                               SECCertUsage certusage);

static SECStatus myExtraVerificationOnCert(CERTCertificate* cert,
                                           SECCertUsage certusage) {
  RefPtr<SharedCertVerifier> certVerifier;
  certVerifier = GetDefaultCertVerifier();
  if (!certVerifier) {
    return SECFailure;
  }

  SECCertificateUsage usageForPkix;

  switch (certusage) {
    case certUsageEmailSigner:
      usageForPkix = certificateUsageEmailSigner;
      break;
    case certUsageEmailRecipient:
      usageForPkix = certificateUsageEmailRecipient;
      break;
    default:
      return SECFailure;
  }

  UniqueCERTCertList builtChain;
  mozilla::pkix::Result result = certVerifier->VerifyCert(
      cert, usageForPkix, Now(), nullptr /*XXX pinarg*/, nullptr /*hostname*/,
      builtChain);
      // Needed for Bug 1500003 but not for our level right now.
      // Only local checks can run on the main thread.
      // CertVerifier::FLAG_LOCAL_ONLY);
  if (result != mozilla::pkix::Success) {
    return SECFailure;
  }

  return SECSuccess;
}

// This is a temporary copy of NSS_CMSSignedData_ImportCerts, which
// performs additional verifications prior to import.
// The copy is almost identical to the original.
//
// The ONLY DIFFERENCE is the addition of parameter extraVerifyFn,
// and the call to it - plus a non-null check.
//
// NSS should add this or a similar API in the future,
// and then these temporary functions should be removed, including
// the ones above. Request is tracked in bugzilla 1738592.
static SECStatus myNSS_CMSSignedData_ImportCerts(
    NSSCMSSignedData* sigd, CERTCertDBHandle* certdb, SECCertUsage certusage,
    PRBool keepcerts, extraVerificationOnCertFn extraVerifyFn) {
  int certcount;
  CERTCertificate** certArray = NULL;
  CERTCertList* certList = NULL;
  CERTCertListNode* node;
  SECStatus rv;
  SECItem** rawArray;
  int i;
  PRTime now;

  if (!sigd) {
    PORT_SetError(SEC_ERROR_INVALID_ARGS);
    return SECFailure;
  }

  certcount = myNSS_CMSArray_Count((void**)sigd->rawCerts);

  /* get the certs in the temp DB */
  rv = CERT_ImportCerts(certdb, certusage, certcount, sigd->rawCerts,
                        &certArray, PR_FALSE, PR_FALSE, NULL);
  if (rv != SECSuccess) {
    goto loser;
  }

  /* save the certs so they don't get destroyed */
  for (i = 0; i < certcount; i++) {
    CERTCertificate* cert = certArray[i];
    if (cert) myNSS_CMSSignedData_AddTempCertificate(sigd, cert);
  }

  if (!keepcerts) {
    goto done;
  }

  /* build a CertList for filtering */
  certList = CERT_NewCertList();
  if (certList == NULL) {
    rv = SECFailure;
    goto loser;
  }
  for (i = 0; i < certcount; i++) {
    CERTCertificate* cert = certArray[i];
    if (cert) cert = CERT_DupCertificate(cert);
    if (cert) CERT_AddCertToListTail(certList, cert);
  }

  /* filter out the certs we don't want */
  rv = CERT_FilterCertListByUsage(certList, certusage, PR_FALSE);
  if (rv != SECSuccess) {
    goto loser;
  }

  /* go down the remaining list of certs and verify that they have
   * valid chains, then import them.
   */
  now = PR_Now();
  for (node = CERT_LIST_HEAD(certList); !CERT_LIST_END(node, certList);
       node = CERT_LIST_NEXT(node)) {
    CERTCertificateList* certChain;

    if (!node->cert) {
      continue;
    }

    if (extraVerifyFn) {
      if ((*extraVerifyFn)(node->cert, certusage) != SECSuccess) {
        continue;
      }
    }

    if (CERT_VerifyCert(certdb, node->cert, PR_TRUE, certusage, now, NULL,
                        NULL) != SECSuccess) {
      continue;
    }

    certChain = CERT_CertChainFromCert(node->cert, certusage, PR_FALSE);
    if (!certChain) {
      continue;
    }

    /*
     * CertChain returns an array of SECItems, import expects an array of
     * SECItem pointers. Create the SECItem Pointers from the array of
     * SECItems.
     */
    rawArray = (SECItem**)PORT_Alloc(certChain->len * sizeof(SECItem*));
    if (!rawArray) {
      CERT_DestroyCertificateList(certChain);
      continue;
    }
    for (i = 0; i < certChain->len; i++) {
      rawArray[i] = &certChain->certs[i];
    }
    (void)CERT_ImportCerts(certdb, certusage, certChain->len, rawArray, NULL,
                           keepcerts, PR_FALSE, NULL);
    PORT_Free(rawArray);
    CERT_DestroyCertificateList(certChain);
  }

  rv = SECSuccess;

  /* XXX CRL handling */

done:
  if (sigd->signerInfos != NULL) {
    /* fill in all signerinfo's certs */
    for (i = 0; sigd->signerInfos[i] != NULL; i++)
      (void)NSS_CMSSignerInfo_GetSigningCertificate(sigd->signerInfos[i],
                                                    certdb);
  }

loser:
  /* now free everything */
  if (certArray) {
    CERT_DestroyCertArray(certArray, certcount);
  }
  if (certList) {
    CERT_DestroyCertList(certList);
  }

  return rv;
}

nsresult nsCMSMessage::CommonVerifySignature(unsigned char* aDigestData, uint32_t aDigestDataLen)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature, content level count %d\n", NSS_CMSMessage_ContentLevelCount(m_cmsMsg)));
  NSSCMSContentInfo *cinfo = nullptr;
  NSSCMSSignedData *sigd = nullptr;
  NSSCMSSignerInfo *si;
  int32_t nsigners;
  nsresult rv = NS_ERROR_FAILURE;

  if (!NSS_CMSMessage_IsSigned(m_cmsMsg)) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - not signed\n"));
    return NS_ERROR_CMS_VERIFY_NOT_SIGNED;
  }

  cinfo = NSS_CMSMessage_ContentLevel(m_cmsMsg, 0);
  if (cinfo) {
    // I don't like this hard cast. We should check in some way, that we really have this type.
    sigd = (NSSCMSSignedData*)NSS_CMSContentInfo_GetContent(cinfo);
  }

  if (!sigd) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - no content info\n"));
    rv = NS_ERROR_CMS_VERIFY_NO_CONTENT_INFO;
    goto loser;
  }

  if (aDigestData && aDigestDataLen)
  {
    SECItem digest;
    digest.data = aDigestData;
    digest.len = aDigestDataLen;

    if (NSS_CMSSignedData_SetDigestValue(sigd, SEC_OID_SHA1, &digest)) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - bad digest\n"));
      rv = NS_ERROR_CMS_VERIFY_BAD_DIGEST;
      goto loser;
    }
  }

  // Import certs. Note that import failure is not a signature verification failure. //
  if (myNSS_CMSSignedData_ImportCerts(
          sigd, CERT_GetDefaultCertDB(), certUsageEmailRecipient, true,
          myExtraVerificationOnCert) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - can not import certs\n"));
  }

  nsigners = NSS_CMSSignedData_SignerInfoCount(sigd);
  PR_ASSERT(nsigners > 0);
  NS_ENSURE_TRUE(nsigners > 0, NS_ERROR_UNEXPECTED);
  si = NSS_CMSSignedData_GetSignerInfo(sigd, 0);

  NS_ENSURE_TRUE(si, NS_ERROR_UNEXPECTED);
  NS_ENSURE_TRUE(si->cert, NS_ERROR_UNEXPECTED);

  // See bug 324474. We want to make sure the signing cert is
  // still valid at the current time.
  if (myExtraVerificationOnCert(si->cert, certUsageEmailSigner) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug,
            ("nsCMSMessage::CommonVerifySignature - signing cert not trusted "
             "now"));
    rv = NS_ERROR_CMS_VERIFY_UNTRUSTED;
    goto loser;
  }

  // We verify the first signer info,  only //
  // XXX: NSS_CMSSignedData_VerifySignerInfo calls CERT_VerifyCert, which
  // requires NSS's certificate verification configuration to be done in
  // order to work well (e.g. honoring OCSP preferences and proxy settings
  // for OCSP requests), but Gecko stopped doing that configuration. Something
  // similar to what was done for Gecko bug 1028643 needs to be done here too.
  if (NSS_CMSSignedData_VerifySignerInfo(sigd, 0, CERT_GetDefaultCertDB(), certUsageEmailSigner) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - unable to verify signature\n"));

    if (NSSCMSVS_SigningCertNotFound == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - signing cert not found\n"));
      rv = NS_ERROR_CMS_VERIFY_NOCERT;
    }
    else if(NSSCMSVS_SigningCertNotTrusted == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - signing cert not trusted at signing time\n"));
      rv = NS_ERROR_CMS_VERIFY_UNTRUSTED;
    }
    else if(NSSCMSVS_Unverified == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - can not verify\n"));
      rv = NS_ERROR_CMS_VERIFY_ERROR_UNVERIFIED;
    }
    else if(NSSCMSVS_ProcessingError == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - processing error\n"));
      rv = NS_ERROR_CMS_VERIFY_ERROR_PROCESSING;
    }
    else if(NSSCMSVS_BadSignature == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - bad signature\n"));
      rv = NS_ERROR_CMS_VERIFY_BAD_SIGNATURE;
    }
    else if(NSSCMSVS_DigestMismatch == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - digest mismatch\n"));
      rv = NS_ERROR_CMS_VERIFY_DIGEST_MISMATCH;
    }
    else if(NSSCMSVS_SignatureAlgorithmUnknown == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - algo unknown\n"));
      rv = NS_ERROR_CMS_VERIFY_UNKNOWN_ALGO;
    }
    else if(NSSCMSVS_SignatureAlgorithmUnsupported == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - algo not supported\n"));
      rv = NS_ERROR_CMS_VERIFY_UNSUPPORTED_ALGO;
    }
    else if(NSSCMSVS_MalformedSignature == si->verificationStatus) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - malformed signature\n"));
      rv = NS_ERROR_CMS_VERIFY_MALFORMED_SIGNATURE;
    }

    goto loser;
  }

  // Save the profile. Note that save import failure is not a signature verification failure. //
  if (NSS_SMIMESignerInfo_SaveSMIMEProfile(si) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CommonVerifySignature - unable to save smime profile\n"));
  }

  rv = NS_OK;
loser:
  return rv;
}

NS_IMETHODIMP nsCMSMessage::AsyncVerifySignature(
                              nsISMimeVerificationListener *aListener)
{
  return CommonAsyncVerifySignature(aListener, nullptr, 0);
}

NS_IMETHODIMP nsCMSMessage::AsyncVerifyDetachedSignature(
                              nsISMimeVerificationListener *aListener,
                              unsigned char* aDigestData, uint32_t aDigestDataLen)
{
  if (!aDigestData || !aDigestDataLen)
    return NS_ERROR_FAILURE;

  return CommonAsyncVerifySignature(aListener, aDigestData, aDigestDataLen);
}

class SMimeVerificationTask final : public CryptoTask
{
public:
  SMimeVerificationTask(nsICMSMessage *aMessage,
                        nsISMimeVerificationListener *aListener,
                        unsigned char *aDigestData, uint32_t aDigestDataLen)
  {
    MOZ_ASSERT(NS_IsMainThread());
    mMessage = aMessage;
    mListener = aListener;
    mDigestData.Assign(reinterpret_cast<char *>(aDigestData), aDigestDataLen);
  }

private:
  virtual nsresult CalculateResult() override
  {
    MOZ_ASSERT(!NS_IsMainThread());

    mozilla::StaticMutexAutoLock lock(sMutex);
    nsresult rv;
    if (!mDigestData.IsEmpty()) {
      rv = mMessage->VerifyDetachedSignature(
        reinterpret_cast<uint8_t*>(const_cast<char *>(mDigestData.get())),
        mDigestData.Length());
    } else {
      rv = mMessage->VerifySignature();
    }

    return rv;
  }
  virtual void CallCallback(nsresult rv) override
  {
    MOZ_ASSERT(NS_IsMainThread());

    nsCOMPtr<nsICMSMessage2> m2 = do_QueryInterface(mMessage);
    mListener->Notify(m2, rv);
  }

  nsCOMPtr<nsICMSMessage> mMessage;
  nsCOMPtr<nsISMimeVerificationListener> mListener;
  nsCString mDigestData;

  static mozilla::StaticMutex sMutex;

};

mozilla::StaticMutex SMimeVerificationTask::sMutex;

nsresult nsCMSMessage::CommonAsyncVerifySignature(nsISMimeVerificationListener *aListener,
                                                  unsigned char* aDigestData, uint32_t aDigestDataLen)
{
  RefPtr<CryptoTask> task = new SMimeVerificationTask(this, aListener, aDigestData, aDigestDataLen);
  return task->Dispatch("SMimeVerify");
}

class nsZeroTerminatedCertArray
{
public:
  nsZeroTerminatedCertArray()
  :mCerts(nullptr), mPoolp(nullptr), mSize(0)
  {
  }

  ~nsZeroTerminatedCertArray()
  {
    if (mCerts)
    {
      for (uint32_t i=0; i < mSize; i++) {
        if (mCerts[i]) {
          CERT_DestroyCertificate(mCerts[i]);
        }
      }
    }

    if (mPoolp)
      PORT_FreeArena(mPoolp, false);
  }

  bool allocate(uint32_t count)
  {
    // only allow allocation once
    if (mPoolp)
      return false;

    mSize = count;

    if (!mSize)
      return false;

    mPoolp = PORT_NewArena(1024);
    if (!mPoolp)
      return false;

    mCerts = (CERTCertificate**)PORT_ArenaZAlloc(
      mPoolp, (count+1)*sizeof(CERTCertificate*));

    if (!mCerts)
      return false;

    // null array, including zero termination
    for (uint32_t i = 0; i < count+1; i++) {
      mCerts[i] = nullptr;
    }

    return true;
  }

  void set(uint32_t i, CERTCertificate *c)
  {
    if (i >= mSize)
      return;

    if (mCerts[i]) {
      CERT_DestroyCertificate(mCerts[i]);
    }

    mCerts[i] = CERT_DupCertificate(c);
  }

  CERTCertificate *get(uint32_t i)
  {
    if (i >= mSize)
      return nullptr;

    return CERT_DupCertificate(mCerts[i]);
  }

  CERTCertificate **getRawArray()
  {
    return mCerts;
  }

private:
  CERTCertificate **mCerts;
  PLArenaPool *mPoolp;
  uint32_t mSize;
};

NS_IMETHODIMP nsCMSMessage::CreateEncrypted(nsIArray * aRecipientCerts)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted\n"));
  NSSCMSContentInfo *cinfo;
  NSSCMSEnvelopedData *envd;
  NSSCMSRecipientInfo *recipientInfo;
  nsZeroTerminatedCertArray recipientCerts;
  SECOidTag bulkAlgTag;
  int keySize;
  uint32_t i;
  nsresult rv = NS_ERROR_FAILURE;

  // Check the recipient certificates //
  uint32_t recipientCertCount;
  aRecipientCerts->GetLength(&recipientCertCount);
  PR_ASSERT(recipientCertCount > 0);

  if (!recipientCerts.allocate(recipientCertCount)) {
    goto loser;
  }

  for (i=0; i<recipientCertCount; i++) {
    nsCOMPtr<nsIX509Cert> x509cert = do_QueryElementAt(aRecipientCerts, i);

    if (!x509cert)
      return NS_ERROR_FAILURE;

    UniqueCERTCertificate c(x509cert->GetCert());
    recipientCerts.set(i, c.get());
  }

  // Find a bulk key algorithm //
  if (NSS_SMIMEUtil_FindBulkAlgForRecipients(recipientCerts.getRawArray(), &bulkAlgTag,
                                            &keySize) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't find bulk alg for recipients\n"));
    rv = NS_ERROR_CMS_ENCRYPT_NO_BULK_ALG;
    goto loser;
  }

  m_cmsMsg = NSS_CMSMessage_Create(nullptr);
  if (!m_cmsMsg) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't create new cms message\n"));
    rv = NS_ERROR_OUT_OF_MEMORY;
    goto loser;
  }

  if ((envd = NSS_CMSEnvelopedData_Create(m_cmsMsg, bulkAlgTag, keySize)) == nullptr) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't create enveloped data\n"));
    goto loser;
  }

  cinfo = NSS_CMSMessage_GetContentInfo(m_cmsMsg);
  if (NSS_CMSContentInfo_SetContent_EnvelopedData(m_cmsMsg, cinfo, envd) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't create content enveloped data\n"));
    goto loser;
  }

  cinfo = NSS_CMSEnvelopedData_GetContentInfo(envd);
  if (NSS_CMSContentInfo_SetContent_Data(m_cmsMsg, cinfo, nullptr, false) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't set content data\n"));
    goto loser;
  }

  // Create and attach recipient information //
  for (i=0; i < recipientCertCount; i++) {
    UniqueCERTCertificate rc(recipientCerts.get(i));
    if ((recipientInfo = NSS_CMSRecipientInfo_Create(m_cmsMsg, rc.get())) == nullptr) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't create recipient info\n"));
      goto loser;
    }
    if (NSS_CMSEnvelopedData_AddRecipient(envd, recipientInfo) != SECSuccess) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateEncrypted - can't add recipient info\n"));
      goto loser;
    }
  }

  return NS_OK;
loser:
  if (m_cmsMsg) {
    NSS_CMSMessage_Destroy(m_cmsMsg);
    m_cmsMsg = nullptr;
  }

  return rv;
}

NS_IMETHODIMP
nsCMSMessage::CreateSigned(nsIX509Cert* aSigningCert, nsIX509Cert* aEncryptCert,
                           unsigned char* aDigestData, uint32_t aDigestDataLen,
                           int16_t aDigestType)
{
  NS_ENSURE_ARG(aSigningCert);
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned\n"));
  NSSCMSContentInfo *cinfo;
  NSSCMSSignedData *sigd;
  NSSCMSSignerInfo *signerinfo;
  UniqueCERTCertificate scert(aSigningCert->GetCert());
  UniqueCERTCertificate ecert;
  nsresult rv = NS_ERROR_FAILURE;

  if (!scert) {
    return NS_ERROR_FAILURE;
  }

  if (aEncryptCert) {
    ecert = UniqueCERTCertificate(aEncryptCert->GetCert());
  }

  SECOidTag digestType;
  switch (aDigestType) {
    case nsICryptoHash::SHA1:
      digestType = SEC_OID_SHA1;
      break;
    case nsICryptoHash::SHA256:
      digestType = SEC_OID_SHA256;
      break;
    case nsICryptoHash::SHA384:
      digestType = SEC_OID_SHA384;
      break;
    case nsICryptoHash::SHA512:
      digestType = SEC_OID_SHA512;
      break;
    default:
      return NS_ERROR_INVALID_ARG;
  }

  /*
   * create the message object
   */
  m_cmsMsg = NSS_CMSMessage_Create(nullptr); /* create a message on its own pool */
  if (!m_cmsMsg) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't create new message\n"));
    rv = NS_ERROR_OUT_OF_MEMORY;
    goto loser;
  }

  /*
   * build chain of objects: message->signedData->data
   */
  if ((sigd = NSS_CMSSignedData_Create(m_cmsMsg)) == nullptr) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't create signed data\n"));
    goto loser;
  }
  cinfo = NSS_CMSMessage_GetContentInfo(m_cmsMsg);
  if (NSS_CMSContentInfo_SetContent_SignedData(m_cmsMsg, cinfo, sigd)
          != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't set content signed data\n"));
    goto loser;
  }

  cinfo = NSS_CMSSignedData_GetContentInfo(sigd);

  /* we're always passing data in and detaching optionally */
  if (NSS_CMSContentInfo_SetContent_Data(m_cmsMsg, cinfo, nullptr, true)
          != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't set content data\n"));
    goto loser;
  }

  /*
   * create & attach signer information
   */
  signerinfo = NSS_CMSSignerInfo_Create(m_cmsMsg, scert.get(), digestType);
  if (!signerinfo) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't create signer info\n"));
    goto loser;
  }

  /* we want the cert chain included for this one */
  if (NSS_CMSSignerInfo_IncludeCerts(signerinfo, NSSCMSCM_CertChain,
                                       certUsageEmailSigner)
          != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't include signer cert chain\n"));
    goto loser;
  }

  if (NSS_CMSSignerInfo_AddSigningTime(signerinfo, PR_Now())
	      != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add signing time\n"));
    goto loser;
  }

  if (NSS_CMSSignerInfo_AddSMIMECaps(signerinfo) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add smime caps\n"));
    goto loser;
  }

  if (ecert) {
    if (NSS_CMSSignerInfo_AddSMIMEEncKeyPrefs(signerinfo, ecert.get(),
	                                      CERT_GetDefaultCertDB())
	  != SECSuccess) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add smime enc key prefs\n"));
      goto loser;
    }

    if (NSS_CMSSignerInfo_AddMSSMIMEEncKeyPrefs(signerinfo, ecert.get(),
	                                        CERT_GetDefaultCertDB())
	  != SECSuccess) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add MS smime enc key prefs\n"));
      goto loser;
    }

    // If signing and encryption cert are identical, don't add it twice.
    bool addEncryptionCert =
      (ecert && (!scert || !CERT_CompareCerts(ecert.get(), scert.get())));

    if (addEncryptionCert &&
        NSS_CMSSignedData_AddCertificate(sigd, ecert.get()) != SECSuccess) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add own encryption certificate\n"));
      goto loser;
    }
  }

  if (NSS_CMSSignedData_AddSignerInfo(sigd, signerinfo) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't add signer info\n"));
    goto loser;
  }

  // Finally, add the pre-computed digest if passed in
  if (aDigestData) {
    SECItem digest;

    digest.data = aDigestData;
    digest.len = aDigestDataLen;

    if (NSS_CMSSignedData_SetDigestValue(sigd, digestType, &digest) != SECSuccess) {
      MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSMessage::CreateSigned - can't set digest value\n"));
      goto loser;
    }
  }

  return NS_OK;
loser:
  if (m_cmsMsg) {
    NSS_CMSMessage_Destroy(m_cmsMsg);
    m_cmsMsg = nullptr;
  }
  return rv;
}

NS_IMPL_ISUPPORTS(nsCMSDecoder, nsICMSDecoder)

nsCMSDecoder::nsCMSDecoder()
: m_dcx(nullptr)
{
}

nsCMSDecoder::~nsCMSDecoder()
{
  if (m_dcx) {
    NSS_CMSDecoder_Cancel(m_dcx);
    m_dcx = nullptr;
  }
}

nsresult nsCMSDecoder::Init()
{
  nsresult rv;
  nsCOMPtr<nsISupports> nssInitialized = do_GetService("@mozilla.org/psm;1", &rv);
  return rv;
}

/* void start (in NSSCMSContentCallback cb, in voidPtr arg); */
NS_IMETHODIMP nsCMSDecoder::Start(NSSCMSContentCallback cb, void * arg)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSDecoder::Start\n"));
  m_ctx = new PipUIContext();

  m_dcx = NSS_CMSDecoder_Start(0, cb, arg, 0, m_ctx, 0, 0);
  if (!m_dcx) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSDecoder::Start - can't start decoder\n"));
    return NS_ERROR_FAILURE;
  }
  return NS_OK;
}

/* void update (in string bug, in long len); */
NS_IMETHODIMP nsCMSDecoder::Update(const char *buf, int32_t len)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSDecoder::Update\n"));
  NSS_CMSDecoder_Update(m_dcx, (char *)buf, len);
  return NS_OK;
}

/* void finish (); */
NS_IMETHODIMP nsCMSDecoder::Finish(nsICMSMessage ** aCMSMsg)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSDecoder::Finish\n"));
  NSSCMSMessage *cmsMsg;
  cmsMsg = NSS_CMSDecoder_Finish(m_dcx);
  m_dcx = nullptr;
  if (cmsMsg) {
    nsCMSMessage *obj = new nsCMSMessage(cmsMsg);
    // The NSS object cmsMsg still carries a reference to the context
    // we gave it on construction.
    // Make sure the context will live long enough.
    obj->referenceContext(m_ctx);
    NS_ADDREF(*aCMSMsg = obj);
  }
  return NS_OK;
}

NS_IMPL_ISUPPORTS(nsCMSEncoder, nsICMSEncoder)

nsCMSEncoder::nsCMSEncoder()
: m_ecx(nullptr)
{
}

nsCMSEncoder::~nsCMSEncoder()
{
  if (m_ecx) {
    NSS_CMSEncoder_Cancel(m_ecx);
  }
}

nsresult nsCMSEncoder::Init()
{
  nsresult rv;
  nsCOMPtr<nsISupports> nssInitialized = do_GetService("@mozilla.org/psm;1", &rv);
  return rv;
}

/* void start (); */
NS_IMETHODIMP nsCMSEncoder::Start(nsICMSMessage *aMsg, NSSCMSContentCallback cb, void * arg)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Start\n"));
  nsCMSMessage *cmsMsg = static_cast<nsCMSMessage*>(aMsg);
  m_ctx = new PipUIContext();

  m_ecx = NSS_CMSEncoder_Start(cmsMsg->getCMS(), cb, arg, 0, 0, 0, m_ctx, 0, 0, 0, 0);
  if (!m_ecx) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Start - can't start encoder\n"));
    return NS_ERROR_FAILURE;
  }
  return NS_OK;
}

/* void update (in string aBuf, in long aLen); */
NS_IMETHODIMP nsCMSEncoder::Update(const char *aBuf, int32_t aLen)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Update\n"));
  if (!m_ecx || NSS_CMSEncoder_Update(m_ecx, aBuf, aLen) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Update - can't update encoder\n"));
    return NS_ERROR_FAILURE;
  }
  return NS_OK;
}

/* void finish (); */
NS_IMETHODIMP nsCMSEncoder::Finish()
{
  nsresult rv = NS_OK;
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Finish\n"));
  if (!m_ecx || NSS_CMSEncoder_Finish(m_ecx) != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Finish - can't finish encoder\n"));
    rv = NS_ERROR_FAILURE;
  }
  m_ecx = nullptr;
  return rv;
}

/* void encode (in nsICMSMessage aMsg); */
NS_IMETHODIMP nsCMSEncoder::Encode(nsICMSMessage *aMsg)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSEncoder::Encode\n"));
  return NS_ERROR_NOT_IMPLEMENTED;
}
