/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The Mac sandbox module is a static library (a Library in moz.build terms)
// that can be linked into any binary (for example plugin-container or XUL).
// It must not have dependencies on any other Mozilla module.  This is why,
// for example, it has its own OS X version detection code, rather than
// linking to nsCocoaFeatures.mm in XUL.

#include "Sandbox.h"

#include <stdio.h>
#include <stdlib.h>
#include <CoreFoundation/CoreFoundation.h>

#include <vector>

#include "mozilla/Assertions.h"

// Undocumented sandbox setup routines.
extern "C" int sandbox_init_with_parameters(const char *profile, uint64_t flags, const char *const parameters[], char **errorbuf);
extern "C" void sandbox_free_error(char *errorbuf);

// Note about "major", "minor" and "bugfix" in the following code:
//
// The code decomposes an OS X version number into these components, and in
// doing so follows Apple's terminology in Gestalt.h.  But this is very
// misleading, because in other contexts Apple uses the "minor" component of
// an OS X version number to indicate a "major" release (for example the "9"
// in OS X 10.9.5), and the "bugfix" component to indicate a "minor" release
// (for example the "5" in OS X 10.9.5).
class OSXVersion {
public:
  static void Get(int32_t& aMajor, int32_t& aMinor);

private:
  static void GetSystemVersion(int32_t& aMajor, int32_t& aMinor, int32_t& aBugFix);
  static bool mCached;
  static int32_t mOSXVersionMajor;
  static int32_t mOSXVersionMinor;
};

bool OSXVersion::mCached = false;
int32_t OSXVersion::mOSXVersionMajor;
int32_t OSXVersion::mOSXVersionMinor;

void OSXVersion::Get(int32_t& aMajor, int32_t& aMinor) {
  if (!mCached) {
    int32_t major, minor, bugfix;
    GetSystemVersion(major, minor, bugfix);
    mOSXVersionMajor = major;
    mOSXVersionMinor = minor;
    mCached = true;
  }
  aMajor = mOSXVersionMajor;
  aMinor = mOSXVersionMinor;
}

void
OSXVersion::GetSystemVersion(int32_t& aMajor, int32_t& aMinor, int32_t& aBugFix)
{
  SInt32 major = 0, minor = 0, bugfix = 0;

  CFURLRef url =
    CFURLCreateWithString(kCFAllocatorDefault,
                          CFSTR("file:///System/Library/CoreServices/SystemVersion.plist"),
                          NULL);
  CFReadStreamRef stream =
    CFReadStreamCreateWithFile(kCFAllocatorDefault, url);
  CFReadStreamOpen(stream);
  CFDictionaryRef sysVersionPlist = (CFDictionaryRef)
    CFPropertyListCreateWithStream(kCFAllocatorDefault,
                                   stream, 0, kCFPropertyListImmutable,
                                   NULL, NULL);
  CFReadStreamClose(stream);
  CFRelease(stream);
  CFRelease(url);

  CFStringRef versionString = (CFStringRef)
    CFDictionaryGetValue(sysVersionPlist, CFSTR("ProductVersion"));
  CFArrayRef versions =
    CFStringCreateArrayBySeparatingStrings(kCFAllocatorDefault,
                                           versionString, CFSTR("."));
  CFIndex count = CFArrayGetCount(versions);
  if (count > 0) {
    CFStringRef component = (CFStringRef) CFArrayGetValueAtIndex(versions, 0);
    major = CFStringGetIntValue(component);
    if (count > 1) {
      component = (CFStringRef) CFArrayGetValueAtIndex(versions, 1);
      minor = CFStringGetIntValue(component);
      if (count > 2) {
        component = (CFStringRef) CFArrayGetValueAtIndex(versions, 2);
        bugfix = CFStringGetIntValue(component);
      }
    }
  }
  CFRelease(sysVersionPlist);
  CFRelease(versions);

  // If 'major' isn't what we expect, assume the oldest version of OS X we
  // currently support (OS X 10.6).
  if (major != 10) {
    aMajor = 10; aMinor = 6; aBugFix = 0;
  } else {
    aMajor = major; aMinor = minor; aBugFix = bugfix;
  }
}

namespace mozilla {

bool StartMacSandbox(MacSandboxInfo const &aInfo, std::string &aErrorMessage)
{
  std::vector<const char *> params;
  char *profile = NULL;
  bool profile_needs_free = false;

  // Use a combined version number to simplify version check logic
  // in sandbox policies. For example, 10.14 becomes "1014".
  int32_t major = 0, minor = 0;
  OSXVersion::Get(major, minor);
  MOZ_ASSERT(minor >= 0 && minor < 100);
  std::string combinedVersion = std::to_string((major * 100) + minor);

  if (aInfo.type == MacSandboxType_Plugin) {
    profile = const_cast<char *>(pluginSandboxRules);
    params.push_back("SHOULD_LOG");
    params.push_back(aInfo.shouldLog ? "TRUE" : "FALSE");
    params.push_back("PLUGIN_BINARY_PATH");
    params.push_back(aInfo.pluginInfo.pluginBinaryPath.c_str());
    params.push_back("APP_PATH");
    params.push_back(aInfo.appPath.c_str());
    params.push_back("APP_BINARY_PATH");
    params.push_back(aInfo.appBinaryPath.c_str());

    if (aInfo.pluginInfo.type == MacSandboxPluginType_GMPlugin_EME_Widevine) {
      char *widevineProfile = NULL;
      asprintf(&widevineProfile, "%s%s", profile,
        widevinePluginSandboxRulesAddend);
      profile = widevineProfile;
      profile_needs_free = true;
    }
  }
  else if (aInfo.type == MacSandboxType_Content) {
    MOZ_ASSERT(aInfo.level >= 1);
    if (aInfo.level >= 1) {
      profile = const_cast<char *>(contentSandboxRules);
      params.push_back("SHOULD_LOG");
      params.push_back(aInfo.shouldLog ? "TRUE" : "FALSE");
      params.push_back("SANDBOX_LEVEL_1");
      params.push_back(aInfo.level == 1 ? "TRUE" : "FALSE");
      params.push_back("SANDBOX_LEVEL_2");
      params.push_back(aInfo.level == 2 ? "TRUE" : "FALSE");
      params.push_back("SANDBOX_LEVEL_3");
      params.push_back(aInfo.level == 3 ? "TRUE" : "FALSE");
      params.push_back("MAC_OS_VERSION");
      params.push_back(combinedVersion.c_str());
      params.push_back("APP_PATH");
      params.push_back(aInfo.appPath.c_str());
      params.push_back("APP_BINARY_PATH");
      params.push_back(aInfo.appBinaryPath.c_str());
      params.push_back("APP_DIR");
      params.push_back(aInfo.appDir.c_str());
      params.push_back("APP_TEMP_DIR");
      params.push_back(aInfo.appTempDir.c_str());
      params.push_back("PROFILE_DIR");
      params.push_back(aInfo.profileDir.c_str());
      params.push_back("HOME_PATH");
      params.push_back(getenv("HOME"));
      params.push_back("HAS_SANDBOXED_PROFILE");
      params.push_back(aInfo.hasSandboxedProfile ? "TRUE" : "FALSE");
      params.push_back("HAS_FILE_PRIVILEGES");
      params.push_back(aInfo.hasFilePrivileges ? "TRUE" : "FALSE");
      if (!aInfo.testingReadPath1.empty()) {
        params.push_back("TESTING_READ_PATH1");
        params.push_back(aInfo.testingReadPath1.c_str());
      }
      if (!aInfo.testingReadPath2.empty()) {
        params.push_back("TESTING_READ_PATH2");
        params.push_back(aInfo.testingReadPath2.c_str());
      }
      if (!aInfo.testingReadPath3.empty()) {
        params.push_back("TESTING_READ_PATH3");
        params.push_back(aInfo.testingReadPath3.c_str());
      }
      if (!aInfo.testingReadPath4.empty()) {
        params.push_back("TESTING_READ_PATH4");
        params.push_back(aInfo.testingReadPath4.c_str());
      }
#ifdef DEBUG
      if (!aInfo.debugWriteDir.empty()) {
        params.push_back("DEBUG_WRITE_DIR");
        params.push_back(aInfo.debugWriteDir.c_str());
      }
#endif // DEBUG
    } else {
      fprintf(stderr,
        "Content sandbox disabled due to sandbox level setting\n");
      return false;
    }
  }
  else {
    char *msg = NULL;
    asprintf(&msg, "Unexpected sandbox type %u", aInfo.type);
    if (msg) {
      aErrorMessage.assign(msg);
      free(msg);
    }
    return false;
  }

  if (!profile) {
    fprintf(stderr, "Out of memory in StartMacSandbox()!\n");
    return false;
  }

// In order to avoid relying on any other Mozilla modules (as described at the
// top of this file), we use our own #define instead of the existing MOZ_LOG
// infrastructure. This can be used by developers to debug the macOS sandbox
// policy.
#define MAC_SANDBOX_PRINT_POLICY 0
#if MAC_SANDBOX_PRINT_POLICY
  printf("Sandbox params:\n");
  for (size_t i = 0; i < params.size() / 2; i++) {
    printf("  %s = %s\n", params[i * 2], params[(i * 2) + 1]);
  }
  printf("Sandbox profile:\n%s\n", profile);
#endif

  // The parameters array is null terminated.
  params.push_back(nullptr);

  char *errorbuf = NULL;
  int rv = sandbox_init_with_parameters(profile, 0, params.data(),
                                        &errorbuf);
  if (rv) {
    if (errorbuf) {
      char *msg = NULL;
      asprintf(&msg, "sandbox_init() failed with error \"%s\"", errorbuf);
      if (msg) {
        aErrorMessage.assign(msg);
        free(msg);
      }
      fprintf(stderr, "profile: %s\n", profile);
      sandbox_free_error(errorbuf);
    }
  }
  if (profile_needs_free) {
    free(profile);
  }
  if (rv) {
    return false;
  }

  return true;
}

} // namespace mozilla
