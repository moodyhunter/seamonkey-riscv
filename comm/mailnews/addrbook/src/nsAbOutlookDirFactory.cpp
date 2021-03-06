/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsAbOutlookDirFactory.h"
#include "nsAbWinHelper.h"
#include "nsIAbDirectory.h"
#include "nsIAbManager.h"
#include "nsEnumeratorUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayEnumerator.h"
#include "nsAbBaseCID.h"
#include "mozilla/Logging.h"

NS_IMPL_ISUPPORTS(nsAbOutlookDirFactory, nsIAbDirFactory)

nsAbOutlookDirFactory::nsAbOutlookDirFactory(void)
{
}

nsAbOutlookDirFactory::~nsAbOutlookDirFactory(void)
{
}

extern const char *kOutlookDirectoryScheme;

NS_IMETHODIMP
nsAbOutlookDirFactory::GetDirectories(const nsAString &aDirName,
                                      const nsACString &aURI,
                                      const nsACString &aPrefName,
                                      nsISimpleEnumerator **aDirectories)
{
  NS_ENSURE_ARG_POINTER(aDirectories);

  *aDirectories = nullptr;
  nsresult rv = NS_OK;
  nsCString stub;
  nsCString entry;
  nsAbWinType abType = getAbWinType(kOutlookDirectoryScheme,
                                    nsCString(aURI).get(), stub, entry);

  if (abType == nsAbWinType_Unknown) {
    return NS_ERROR_FAILURE;
  }
  nsAbWinHelperGuard mapiAddBook(abType);
  nsMapiEntryArray folders;
  nsCOMPtr<nsIMutableArray> directories(do_CreateInstance(NS_ARRAY_CONTRACTID));
  NS_ENSURE_SUCCESS(rv, rv);
  if (!mapiAddBook->IsOK() || !mapiAddBook->GetFolders(folders)) {
    return NS_ERROR_FAILURE;
  }

  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsAutoCString entryId;
  nsAutoCString uri;

  for (ULONG i = 0; i < folders.mNbEntries; ++i) {
    folders.mEntries[i].ToString(entryId);
    buildAbWinUri(kOutlookDirectoryScheme, abType, uri);
    uri.Append(entryId);

	nsCOMPtr<nsIAbDirectory> directory;
	rv = abManager->GetDirectory(uri, getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);
    directories->AppendElement(directory);
  }
  return NS_NewArrayEnumerator(aDirectories, directories);
}

// No actual deletion, since you cannot create the address books from Mozilla.
NS_IMETHODIMP nsAbOutlookDirFactory::DeleteDirectory(nsIAbDirectory *aDirectory)
{
  return NS_OK;
}

