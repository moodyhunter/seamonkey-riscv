/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSHistory_h
#define nsSHistory_h

#include "nsCOMPtr.h"
#include "nsExpirationTracker.h"
#include "nsIPartialSHistoryListener.h"
#include "nsISHistory.h"
#include "nsISHistoryInternal.h"
#include "nsISimpleEnumerator.h"
#include "nsIWebNavigation.h"
#include "nsSHEntryShared.h"
#include "nsTObserverArray.h"
#include "nsWeakReference.h"

#include "mozilla/LinkedList.h"
#include "mozilla/UniquePtr.h"

class nsIDocShell;
class nsSHEnumerator;
class nsSHistoryObserver;
class nsISHEntry;
class nsISHTransaction;

class nsSHistory final : public mozilla::LinkedListElement<nsSHistory>,
                         public nsISHistory,
                         public nsISHistoryInternal,
                         public nsIWebNavigation,
                         public nsSupportsWeakReference
{
public:

  // The timer based history tracker is used to evict bfcache on expiration.
  class HistoryTracker final : public nsExpirationTracker<nsSHEntryShared, 3>
  {
  public:
    explicit HistoryTracker(nsSHistory* aSHistory,
                            uint32_t aTimeout,
                            nsIEventTarget* aEventTarget)
      : nsExpirationTracker(1000 * aTimeout / 2, "HistoryTracker", aEventTarget)
    {
      MOZ_ASSERT(aSHistory);
      mSHistory = aSHistory;
    }

  protected:
    virtual void NotifyExpired(nsSHEntryShared* aObj) override
    {
      RemoveObject(aObj);
      mSHistory->EvictExpiredContentViewerForEntry(aObj);
    }

  private:
    // HistoryTracker is owned by nsSHistory; it always outlives HistoryTracker
    // so it's safe to use raw pointer here.
    nsSHistory* mSHistory;
  };

  nsSHistory();
  NS_DECL_ISUPPORTS
  NS_DECL_NSISHISTORY
  NS_DECL_NSISHISTORYINTERNAL
  NS_DECL_NSIWEBNAVIGATION

  // One time initialization method called upon docshell module construction
  static nsresult Startup();
  static void Shutdown();
  static void UpdatePrefs();

  // Max number of total cached content viewers.  If the pref
  // browser.sessionhistory.max_total_viewers is negative, then
  // this value is calculated based on the total amount of memory.
  // Otherwise, it comes straight from the pref.
  static uint32_t GetMaxTotalViewers() { return sHistoryMaxTotalViewers; }

private:
  virtual ~nsSHistory();
  friend class nsSHEnumerator;
  friend class nsSHistoryObserver;

  nsresult GetTransactionAtIndex(int32_t aIndex, nsISHTransaction** aResult);
  nsresult LoadDifferingEntries(nsISHEntry* aPrevEntry, nsISHEntry* aNextEntry,
                                nsIDocShell* aRootDocShell, long aLoadType,
                                bool& aDifferenceFound);
  nsresult InitiateLoad(nsISHEntry* aFrameEntry, nsIDocShell* aFrameDS,
                        long aLoadType);

  nsresult LoadEntry(int32_t aIndex, long aLoadType, uint32_t aHistCmd);

#ifdef DEBUG
  nsresult PrintHistory();
#endif

  // Find the transaction for a given bfcache entry. It only looks up between
  // the range where alive viewers may exist (i.e nsISHistory::VIEWER_WINDOW).
  nsresult FindTransactionForBFCache(nsIBFCacheEntry* aEntry,
                                     nsISHTransaction** aResult,
                                     int32_t* aResultIndex);

  // Evict content viewers in this window which don't lie in the "safe" range
  // around aIndex.
  void EvictOutOfRangeWindowContentViewers(int32_t aIndex);
  void EvictContentViewerForTransaction(nsISHTransaction* aTrans);
  static void GloballyEvictContentViewers();
  static void GloballyEvictAllContentViewers();

  // Calculates a max number of total
  // content viewers to cache, based on amount of total memory
  static uint32_t CalcMaxTotalViewers();

  nsresult LoadNextPossibleEntry(int32_t aNewIndex, long aLoadType,
                                 uint32_t aHistCmd);

  // aIndex is the index of the transaction which may be removed.
  // If aKeepNext is true, aIndex is compared to aIndex + 1,
  // otherwise comparison is done to aIndex - 1.
  bool RemoveDuplicate(int32_t aIndex, bool aKeepNext);

  // Track all bfcache entries and evict on expiration.
  mozilla::UniquePtr<HistoryTracker> mHistoryTracker;

  nsCOMPtr<nsISHTransaction> mListRoot;
  int32_t mIndex;
  int32_t mLength;
  int32_t mRequestedIndex;

  // The number of entries before this session history object.
  int32_t mGlobalIndexOffset;

  // The number of entries after this session history object.
  int32_t mEntriesInFollowingPartialHistories;

  // Session History listeners
  nsAutoTObserverArray<nsWeakPtr, 2> mListeners;

  // Partial session history listener
  nsWeakPtr mPartialHistoryListener;

  // Weak reference. Do not refcount this.
  nsIDocShell* mRootDocShell;

  // Set to true if attached to a grouped session history.
  bool mIsPartial;

  // Max viewers allowed total, across all SHistory objects
  static int32_t sHistoryMaxTotalViewers;
};

class nsSHEnumerator : public nsISimpleEnumerator
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISIMPLEENUMERATOR

  explicit nsSHEnumerator(nsSHistory* aHistory);

protected:
  friend class nsSHistory;
  virtual ~nsSHEnumerator();

private:
  int32_t mIndex;
  nsSHistory* mSHistory;
};

#endif /* nsSHistory */