/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef PDFIUMENGINESHIM_H
#define PDFIUMENGINESHIM_H

#include "prlink.h"
#include "fpdfview.h"

/* include windows.h for the HDC definitions that we need. */
#include <windows.h>

namespace mozilla {
namespace widget {

typedef void (STDCALL *FPDF_InitLibrary_Pfn)();
typedef void (STDCALL *FPDF_DestroyLibrary_Pfn)();

typedef FPDF_DOCUMENT (STDCALL *FPDF_LoadDocument_Pfn)(FPDF_STRING file_path,
                                                      FPDF_BYTESTRING password);

typedef void(STDCALL *FPDF_CloseDocument_Pfn)(FPDF_DOCUMENT aDocument);

typedef int (STDCALL *FPDF_GetPageCount_Pfn)(FPDF_DOCUMENT aDocument);

typedef FPDF_PAGE (STDCALL *FPDF_LoadPage_Pfn)(FPDF_DOCUMENT aDocument,
                                               int aPageIndex);
typedef void (STDCALL *FPDF_ClosePage_Pfn)(FPDF_PAGE aPage);
typedef void (STDCALL *FPDF_RenderPage_Pfn)(HDC aDC,
                                            FPDF_PAGE aPage,
                                            int aStartX,
                                            int aStartY,
                                            int aSizeX,
                                            int aSizeY,
                                            int aRotate,
                                            int aFlags);

/**
 * This class exposes an interface to the PDFium library and
 * takes care of loading and linking to the appropriate PDFium symbols.
 */
class PDFiumEngineShim
{
public:

  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(PDFiumEngineShim)

  static already_AddRefed<PDFiumEngineShim> GetInstanceOrNull();
  // This function is used for testing purpose only, do not call it in regular
  // code.
  static already_AddRefed<PDFiumEngineShim>
  GetInstanceOrNull(const nsString& aLibrary);

  FPDF_DOCUMENT LoadDocument(FPDF_STRING file_path,
                             FPDF_BYTESTRING aPassword);
  void CloseDocument(FPDF_DOCUMENT aDocument);
  int GetPageCount(FPDF_DOCUMENT aDocument);
  int GetPageSizeByIndex(FPDF_DOCUMENT aDocument, int aPageIndex,
                         double* aWidth, double* aHeight);

  FPDF_PAGE LoadPage(FPDF_DOCUMENT aDocument, int aPageIndex);
  void ClosePage(FPDF_PAGE aPage);
  void RenderPage(HDC aDC, FPDF_PAGE aPage,
                  int aStartX, int aStartY,
                  int aSizeX, int aSizeY,
                  int aRotate, int aFlags);

private:
  PDFiumEngineShim();
  ~PDFiumEngineShim();
  bool Init(const nsString& aLibrary);

  bool        mInitialized ;

  FPDF_InitLibrary_Pfn        mFPDF_InitLibrary;
  FPDF_DestroyLibrary_Pfn     mFPDF_DestroyLibrary;
  FPDF_LoadDocument_Pfn       mFPDF_LoadDocument;
  FPDF_CloseDocument_Pfn      mFPDF_CloseDocument;
  FPDF_GetPageCount_Pfn       mFPDF_GetPageCount;
  FPDF_LoadPage_Pfn           mFPDF_LoadPage;
  FPDF_ClosePage_Pfn          mFPDF_ClosePage;
  FPDF_RenderPage_Pfn         mFPDF_RenderPage;

  PRLibrary*  mPRLibrary;
};

} // namespace widget
} // namespace mozilla

#endif /* PDFIUMENGINESHIM_H */