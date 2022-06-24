/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_DateTimeFormat_h
#define mozilla_DateTimeFormat_h

#include <time.h>
#include "gtest/MozGtestFriend.h"
#include "nsDataHashtable.h"
#include "nsIScriptableDateFormat.h"
#include "nsString.h"
#include "prtime.h"
#include "unicode/udat.h"

namespace mozilla {

class DateTimeFormat {
public:
  // performs a locale sensitive date formatting operation on the PRTime parameter
  static nsresult FormatPRTime(const nsDateFormatSelector aDateFormatSelector,
                               const nsTimeFormatSelector aTimeFormatSelector,
                               const PRTime aPrTime,
                               nsAString& aStringOut);

  // performs a locale sensitive date formatting operation on the PRExplodedTime parameter
  static nsresult FormatPRExplodedTime(const nsDateFormatSelector aDateFormatSelector,
                                       const nsTimeFormatSelector aTimeFormatSelector,
                                       const PRExplodedTime* aExplodedTime,
                                       nsAString& aStringOut);

  static void Shutdown();

private:
  DateTimeFormat() = delete;

  static nsresult Initialize();
  static void DeleteCache();
  static const size_t kMaxCachedFormats = 15;

  FRIEND_TEST(DateTimeFormat, FormatPRExplodedTime);
  FRIEND_TEST(DateTimeFormat, DateFormatSelectors);
  FRIEND_TEST(DateTimeFormat, FormatPRExplodedTimeForeign);
  FRIEND_TEST(DateTimeFormat, DateFormatSelectorsForeign);

  // performs a locale sensitive date formatting operation on the UDate parameter
  static nsresult FormatUDateTime(const nsDateFormatSelector aDateFormatSelector,
                                  const nsTimeFormatSelector aTimeFormatSelector,
                                  const UDate aUDateTime,
                                  const PRTimeParameters* aTimeParameters,
                                  nsAString& aStringOut);

  static nsCString* mLocale;
  static nsDataHashtable<nsCStringHashKey, UDateFormat*>* mFormatCache;
};

}

#endif  /* mozilla_DateTimeFormat_h */
