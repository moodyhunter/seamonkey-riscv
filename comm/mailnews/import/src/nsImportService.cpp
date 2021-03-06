/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsICharsetConverterManager.h"
#include "nsIPlatformCharset.h"
#include "nsICharsetConverterManager.h"

#include "nsString.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsMemory.h"
#include "nsIImportModule.h"
#include "nsIImportService.h"
#include "nsImportMailboxDescriptor.h"
#include "nsImportABDescriptor.h"
#include "nsIImportGeneric.h"
#include "nsImportFieldMap.h"
#include "nsICategoryManager.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "plstr.h"
#include "prmem.h"
#include "nsMsgCompCID.h"
#include "nsThreadUtils.h"
#include "nsIEditor.h"
#include "ImportDebug.h"
#include "nsImportService.h"
#include "nsImportStringBundle.h"
#include "nsCRTGlue.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIMutableArray.h"
#include "nsIArray.h"
#include "nsIMsgSend.h"
#include "nsMsgUtils.h"

mozilla::LazyLogModule IMPORTLOGMODULE("Import");

static nsIImportService *  gImportService = nullptr;
static const char *  kWhitespace = "\b\t\r\n ";


////////////////////////////////////////////////////////////////////////


nsImportService::nsImportService() : m_pModules(nullptr)
{
  IMPORT_LOG0("* nsImport Service Created\n");

  m_didDiscovery = false;

  nsresult rv = nsImportStringBundle::GetStringBundle(IMPORT_MSGS_URL, getter_AddRefs(m_stringBundle));
  if (NS_FAILED(rv))
    IMPORT_LOG0("Failed to get string bundle for Importing Mail");
}


nsImportService::~nsImportService()
{
  gImportService = nullptr;

    if (m_pModules != nullptr)
        delete m_pModules;

  IMPORT_LOG0("* nsImport Service Deleted\n");
}



NS_IMPL_ISUPPORTS(nsImportService, nsIImportService)


NS_IMETHODIMP nsImportService::DiscoverModules(void)
{
  m_didDiscovery = false;
  return DoDiscover();
}

NS_IMETHODIMP nsImportService::CreateNewFieldMap(nsIImportFieldMap **_retval)
{
  return nsImportFieldMap::Create(m_stringBundle, nullptr, NS_GET_IID(nsIImportFieldMap), (void**)_retval);
}

NS_IMETHODIMP nsImportService::CreateNewMailboxDescriptor(nsIImportMailboxDescriptor **_retval)
{
  return nsImportMailboxDescriptor::Create(nullptr, NS_GET_IID(nsIImportMailboxDescriptor), (void**)_retval);
}

NS_IMETHODIMP nsImportService::CreateNewABDescriptor(nsIImportABDescriptor **_retval)
{
  return nsImportABDescriptor::Create(nullptr, NS_GET_IID(nsIImportABDescriptor), (void**)_retval);
}

extern nsresult NS_NewGenericMail(nsIImportGeneric** aImportGeneric);

NS_IMETHODIMP nsImportService::CreateNewGenericMail(nsIImportGeneric **_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  return NS_NewGenericMail(_retval);
}

extern nsresult NS_NewGenericAddressBooks(nsIImportGeneric** aImportGeneric);

NS_IMETHODIMP nsImportService::CreateNewGenericAddressBooks(nsIImportGeneric **_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  return NS_NewGenericAddressBooks(_retval);
}


NS_IMETHODIMP nsImportService::GetModuleCount(const char *filter, int32_t *_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  DoDiscover();

  if (m_pModules != nullptr) {
    ImportModuleDesc *  pDesc;
    int32_t  count = 0;
    for (int32_t i = 0; i < m_pModules->GetCount(); i++) {
      pDesc = m_pModules->GetModuleDesc(i);
      if (pDesc->SupportsThings(filter))
        count++;
    }
    *_retval = count;
  }
  else
    *_retval = 0;

  return NS_OK;
}

NS_IMETHODIMP nsImportService::GetModuleWithCID(const nsCID& cid, nsIImportModule **ppModule)
{
  NS_ASSERTION(ppModule != nullptr, "null ptr");
  if (!ppModule)
    return NS_ERROR_NULL_POINTER;

  *ppModule = nullptr;
  nsresult rv = DoDiscover();
  if (NS_FAILED(rv))
    return rv;
  if (m_pModules == nullptr)
    return NS_ERROR_FAILURE;
  int32_t  cnt = m_pModules->GetCount();
  ImportModuleDesc *pDesc;
  for (int32_t i = 0; i < cnt; i++) {
    pDesc = m_pModules->GetModuleDesc(i);
    if (!pDesc)
      return NS_ERROR_FAILURE;
    if (pDesc->GetCID().Equals(cid)) {
      pDesc->GetModule(ppModule);

      IMPORT_LOG0("* nsImportService::GetSpecificModule - attempted to load module\n");

      if (*ppModule == nullptr)
        return NS_ERROR_FAILURE;
      return NS_OK;
    }
  }

  IMPORT_LOG0("* nsImportService::GetSpecificModule - module not found\n");

  return NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsImportService::GetModuleInfo(const char *filter, int32_t index, char16_t **name, char16_t **moduleDescription)
{
  NS_ASSERTION(name != nullptr, "null ptr");
  NS_ASSERTION(moduleDescription != nullptr, "null ptr");
  if (!name || !moduleDescription)
    return NS_ERROR_NULL_POINTER;

  *name = nullptr;
  *moduleDescription = nullptr;

  DoDiscover();
  if (!m_pModules)
    return NS_ERROR_FAILURE;

  if ((index < 0) || (index >= m_pModules->GetCount()))
    return NS_ERROR_FAILURE;

  ImportModuleDesc *  pDesc;
  int32_t  count = 0;
  for (int32_t i = 0; i < m_pModules->GetCount(); i++) {
    pDesc = m_pModules->GetModuleDesc(i);
    if (pDesc->SupportsThings(filter)) {
      if (count == index) {
        *name = NS_strdup(pDesc->GetName());
        *moduleDescription = NS_strdup(pDesc->GetDescription());
        return NS_OK;
      }
      else
        count++;
    }
  }

  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsImportService::GetModuleName(const char *filter, int32_t index, char16_t **_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = nullptr;

  DoDiscover();
  if (!m_pModules)
    return NS_ERROR_FAILURE;

  if ((index < 0) || (index >= m_pModules->GetCount()))
    return NS_ERROR_FAILURE;

  ImportModuleDesc *  pDesc;
  int32_t  count = 0;
  for (int32_t i = 0; i < m_pModules->GetCount(); i++) {
    pDesc = m_pModules->GetModuleDesc(i);
    if (pDesc->SupportsThings(filter)) {
      if (count == index) {
        *_retval = NS_strdup(pDesc->GetName());
        return NS_OK;
      }
      else
        count++;
    }
  }

  return NS_ERROR_FAILURE;
}


NS_IMETHODIMP nsImportService::GetModuleDescription(const char *filter, int32_t index, char16_t **_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = nullptr;

  DoDiscover();
  if (!m_pModules)
    return NS_ERROR_FAILURE;

  if ((index < 0) || (index >= m_pModules->GetCount()))
    return NS_ERROR_FAILURE;

  ImportModuleDesc *  pDesc;
  int32_t  count = 0;
  for (int32_t i = 0; i < m_pModules->GetCount(); i++) {
    pDesc = m_pModules->GetModuleDesc(i);
    if (pDesc->SupportsThings(filter)) {
      if (count == index) {
        *_retval = NS_strdup(pDesc->GetDescription());
        return NS_OK;
      }
      else
        count++;
    }
  }

  return NS_ERROR_FAILURE;
}

class nsProxySendRunnable : public mozilla::Runnable
{
public:
  nsProxySendRunnable(nsIMsgIdentity *aIdentity,
                       nsIMsgCompFields *aMsgFields,
                       const char *attachment1_type,
                       const nsACString &attachment1_body,
                       bool aIsDraft,
                       nsIArray *aLoadedAttachments,
                       nsIArray *aEmbeddedAttachments,
                       nsIMsgSendListener *aListener);
  NS_DECL_NSIRUNNABLE
private:
  nsCOMPtr<nsIMsgIdentity> m_identity;
  nsCOMPtr<nsIMsgCompFields> m_compFields;
  bool m_isDraft;
  nsCString m_bodyType;
  nsCString m_body;
  nsCOMPtr<nsIArray> m_loadedAttachments;
  nsCOMPtr<nsIArray> m_embeddedAttachments;
  nsCOMPtr<nsIMsgSendListener> m_listener;

};

nsProxySendRunnable::nsProxySendRunnable(nsIMsgIdentity *aIdentity,
                                         nsIMsgCompFields *aMsgFields,
                                         const char *aBodyType,
                                         const nsACString &aBody,
                                         bool aIsDraft,
                                         nsIArray *aLoadedAttachments,
                                         nsIArray *aEmbeddedAttachments,
                                         nsIMsgSendListener *aListener) :
  mozilla::Runnable("nsProxySendRunnable"),
  m_identity(aIdentity), m_compFields(aMsgFields),
  m_isDraft(aIsDraft), m_bodyType(aBodyType),
  m_body(aBody), m_loadedAttachments(aLoadedAttachments),
  m_embeddedAttachments(aEmbeddedAttachments),
  m_listener(aListener)
{
}

NS_IMETHODIMP nsProxySendRunnable::Run()
{
  nsresult rv;
  nsCOMPtr<nsIMsgSend> msgSend = do_CreateInstance(NS_MSGSEND_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return msgSend->CreateRFC822Message(m_identity, m_compFields,
                                      m_bodyType.get(), m_body,
                                      m_isDraft, m_loadedAttachments,
                                      m_embeddedAttachments,
                                      m_listener);
}


NS_IMETHODIMP
nsImportService::CreateRFC822Message(nsIMsgIdentity *aIdentity,
                                     nsIMsgCompFields *aMsgFields,
                                     const char *aBodyType,
                                     const nsACString &aBody,
                                     bool aIsDraft,
                                     nsIArray *aLoadedAttachments,
                                     nsIArray *aEmbeddedAttachments,
                                     nsIMsgSendListener *aListener)
{
    RefPtr<nsProxySendRunnable> runnable =
      new nsProxySendRunnable(aIdentity,
                              aMsgFields,
                              aBodyType,
                              aBody,
                              aIsDraft,
                              aLoadedAttachments,
                              aEmbeddedAttachments,
                              aListener);
    // invoke the callback
    return NS_DispatchToMainThread(runnable);
}

NS_IMETHODIMP nsImportService::GetModule(const char *filter, int32_t index, nsIImportModule **_retval)
{
  NS_ASSERTION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;
  *_retval = nullptr;

  DoDiscover();
  if (!m_pModules)
    return NS_ERROR_FAILURE;

  if ((index < 0) || (index >= m_pModules->GetCount()))
    return NS_ERROR_FAILURE;

  ImportModuleDesc *  pDesc;
  int32_t  count = 0;
  for (int32_t i = 0; i < m_pModules->GetCount(); i++) {
    pDesc = m_pModules->GetModuleDesc(i);
    if (pDesc->SupportsThings(filter)) {
      if (count == index) {
        pDesc->GetModule(_retval);
        break;
      }
      else
        count++;
    }
  }
  if (!(*_retval))
    return NS_ERROR_FAILURE;

  return NS_OK;
}


nsresult nsImportService::DoDiscover(void)
{
  if (m_didDiscovery)
    return NS_OK;

  if (m_pModules != nullptr)
    m_pModules->ClearList();

  nsresult rv;

  nsCOMPtr<nsICategoryManager> catMan = do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> e;
  rv = catMan->EnumerateCategory("mailnewsimport", getter_AddRefs(e));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsISupportsCString> contractid;
  rv = e->GetNext(getter_AddRefs(supports));
  while (NS_SUCCEEDED(rv) && supports)
  {
    contractid = do_QueryInterface(supports);
    if (!contractid)
      break;

    nsCString contractIdStr;
    contractid->ToString(getter_Copies(contractIdStr));
    nsCString supportsStr;
    rv = catMan->GetCategoryEntry("mailnewsimport", contractIdStr.get(), getter_Copies(supportsStr));
    if (NS_SUCCEEDED(rv))
      LoadModuleInfo(contractIdStr.get(), supportsStr.get());
    rv = e->GetNext(getter_AddRefs(supports));
  }

  m_didDiscovery = true;

  return NS_OK;
}

nsresult nsImportService::LoadModuleInfo(const char *pClsId, const char *pSupports)
{
  if (!pClsId || !pSupports)
    return NS_OK;

  if (m_pModules == nullptr)
    m_pModules = new nsImportModuleList();

  // load the component and get all of the info we need from it....
  // then call AddModule
  nsresult  rv;

  nsCID        clsId;
  clsId.Parse(pClsId);
  nsCOMPtr<nsIImportModule> module = do_CreateInstance(clsId, &rv);
  if (NS_FAILED(rv)) return rv;

  nsString  theTitle;
  nsString  theDescription;
  rv = module->GetName(getter_Copies(theTitle));
  if (NS_FAILED(rv))
    theTitle.AssignLiteral("Unknown");

  rv = module->GetDescription(getter_Copies(theDescription));
  if (NS_FAILED(rv))
    theDescription.AssignLiteral("Unknown description");

  // call the module to get the info we need
  m_pModules->AddModule(clsId, pSupports, theTitle.get(), theDescription.get());

  return NS_OK;
}

// XXX This should return already_AddRefed.
void ImportModuleDesc::GetModule(nsIImportModule **_retval)
{
  if (!m_pModule)
  {
    nsresult  rv;
    m_pModule = do_CreateInstance(m_cid, &rv);
    if (NS_FAILED(rv))
      m_pModule = nullptr;
  }

  NS_IF_ADDREF(*_retval = m_pModule);
  return;
}

void ImportModuleDesc::ReleaseModule(void)
{
  m_pModule = nullptr;
}

bool ImportModuleDesc::SupportsThings(const char *pThings)
{
  if (!pThings || !*pThings)
    return true;

  nsCString thing(pThings);
  nsCString item;
  int32_t idx;

  while ((idx = thing.FindChar(',')) != -1)
  {
    item = StringHead(thing, idx);
    item.Trim(kWhitespace);
    ToLowerCase(item);
    if (item.Length() && (m_supports.Find(item) == -1))
      return false;
    thing = Substring(thing, idx + 1);
  }
  thing.Trim(kWhitespace);
  ToLowerCase(thing);
  return thing.IsEmpty() || (m_supports.Find(thing) != -1);
}

void nsImportModuleList::ClearList(void)
{
  if (m_pList)
  {
    for (int i = 0; i < m_count; i++)
    {
      delete m_pList[i];
      m_pList[i] = nullptr;
    }
    m_count = 0;
    delete [] m_pList;
    m_pList = nullptr;
    m_alloc = 0;
  }

}

void nsImportModuleList::AddModule(const nsCID& cid, const char *pSupports, const char16_t *pName, const char16_t *pDesc)
{
  if (!m_pList)
  {
    m_alloc = 10;
    m_pList = new ImportModuleDesc *[m_alloc];
    m_count = 0;
    memset(m_pList, 0, sizeof(ImportModuleDesc *) * m_alloc);
  }

  if (m_count == m_alloc)
  {
    ImportModuleDesc **pList = new ImportModuleDesc *[m_alloc + 10];
    memset(&(pList[m_alloc]), 0, sizeof(ImportModuleDesc *) * 10);
    memcpy(pList, m_pList, sizeof(ImportModuleDesc *) * m_alloc);
    for(int i = 0; i < m_count; i++)
      delete m_pList[i];
    delete [] m_pList;
    m_pList = pList;
    m_alloc += 10;
  }

  m_pList[m_count] = new ImportModuleDesc();
  m_pList[m_count]->SetCID(cid);
  m_pList[m_count]->SetSupports(pSupports);
  m_pList[m_count]->SetName(pName);
  m_pList[m_count]->SetDescription(pDesc);

  m_count++;
#ifdef IMPORT_DEBUG
  IMPORT_LOG3("* nsImportService registered import module: %s, %s, %s\n", NS_LossyConvertUTF16toASCII(pName).get(), NS_LossyConvertUTF16toASCII(pDesc).get(), pSupports);
#endif
}

