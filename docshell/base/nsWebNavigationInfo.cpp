/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsWebNavigationInfo.h"
#include "nsIWebNavigation.h"
#include "nsServiceManagerUtils.h"
#include "nsIDocumentLoaderFactory.h"
#include "nsIDocShell.h"
#include "nsContentUtils.h"
#include "imgLoader.h"
#include "nsPluginHost.h"

NS_IMPL_ISUPPORTS(nsWebNavigationInfo, nsIWebNavigationInfo)

nsresult
nsWebNavigationInfo::Init()
{
  nsresult rv;
  mCategoryManager = do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsWebNavigationInfo::IsTypeSupported(const nsACString& aType,
                                     nsIWebNavigation* aWebNav,
                                     uint32_t* aIsTypeSupported)
{
  NS_PRECONDITION(aIsTypeSupported, "null out param?");

  // Note to self: aWebNav could be an nsWebBrowser or an nsDocShell here (or
  // an nsSHistory, but not much we can do with that).  So if we start using
  // it here, we need to be careful to get to the docshell correctly.

  // For now just report what the Gecko-Content-Viewers category has
  // to say for itself.
  *aIsTypeSupported = nsIWebNavigationInfo::UNSUPPORTED;

  // We want to claim that the type for PDF documents is unsupported,
  // so that the internal PDF viewer's stream converted will get used.
  if (aType.LowerCaseEqualsLiteral("application/pdf") &&
      nsContentUtils::IsPDFJSEnabled()) {
    return NS_OK;
  }

  const nsCString& flatType = PromiseFlatCString(aType);
  nsresult rv = IsTypeSupportedInternal(flatType, aIsTypeSupported);
  NS_ENSURE_SUCCESS(rv, rv);

  if (*aIsTypeSupported) {
    return rv;
  }

  return NS_OK;
}

nsresult
nsWebNavigationInfo::IsTypeSupportedInternal(const nsCString& aType,
                                             uint32_t* aIsSupported)
{
  NS_PRECONDITION(aIsSupported, "Null out param?");

  nsContentUtils::ContentViewerType vtype = nsContentUtils::TYPE_UNSUPPORTED;

  nsCOMPtr<nsIDocumentLoaderFactory> docLoaderFactory =
    nsContentUtils::FindInternalContentViewer(aType, &vtype);

  switch (vtype) {
    case nsContentUtils::TYPE_UNSUPPORTED:
      *aIsSupported = nsIWebNavigationInfo::UNSUPPORTED;
      break;

    case nsContentUtils::TYPE_FALLBACK:
      *aIsSupported = nsIWebNavigationInfo::FALLBACK;
      break;

    case nsContentUtils::TYPE_UNKNOWN:
      *aIsSupported = nsIWebNavigationInfo::OTHER;
      break;

    case nsContentUtils::TYPE_CONTENT:
      // XXXbz we only need this because images register for the same
      // contractid as documents, so we can't tell them apart based on
      // contractid.
      if (imgLoader::SupportImageWithMimeType(aType.get())) {
        *aIsSupported = nsIWebNavigationInfo::IMAGE;
      } else {
        *aIsSupported = nsIWebNavigationInfo::OTHER;
      }
      break;
  }

  return NS_OK;
}
