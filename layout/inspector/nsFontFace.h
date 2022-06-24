/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsFontFace_h__
#define __nsFontFace_h__

#include "nsIDOMFontFace.h"
#include "gfxFont.h"

class gfxFontGroup;

class nsFontFace : public nsIDOMFontFace
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDOMFONTFACE

  nsFontFace(gfxFontEntry*      aFontEntry,
             gfxFontGroup*      aFontGroup,
             gfxTextRange::MatchType aMatchType);

  gfxFontEntry* GetFontEntry() const { return mFontEntry.get(); }

  void AddMatchType(gfxTextRange::MatchType aMatchType) {
    mMatchType |= aMatchType;
  }


protected:
  virtual ~nsFontFace();

  RefPtr<gfxFontEntry> mFontEntry;
  RefPtr<gfxFontGroup> mFontGroup;
  gfxTextRange::MatchType mMatchType;
};

#endif // __nsFontFace_h__
