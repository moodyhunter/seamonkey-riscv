# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This file should ONLY be included from upload-files.mk. It was
# split into its own file to increase comprehension of
# upload-files.mk.

include $(MOZILLA_DIR)/config/android-common.mk

# Files packed into the APK root.  Packing files into the APK root is not
# supported by modern Android build systems, including Gradle, so don't add to
# this list without Android peer approval.
ROOT_FILES := \
  application.ini \
  package-name.txt \
  ua-update.json \
  platform.ini \
  removed-files \
  $(NULL)

GECKO_APP_AP_PATH = $(topobjdir)/mobile/android/base

ifdef ENABLE_TESTS
INNER_ROBOCOP_PACKAGE=true
ifeq ($(MOZ_BUILD_APP),mobile/android)
UPLOAD_EXTRA_FILES += robocop.apk

# Robocop/Robotium tests and Fennec need to be signed with the same
# key, which means release signing them all.

INNER_ROBOCOP_PACKAGE= \
  $(call RELEASE_SIGN_ANDROID_APK,$(GRADLE_ANDROID_APP_ANDROIDTEST_APK),$(ABS_DIST)/robocop.apk)
endif
else
INNER_ROBOCOP_PACKAGE=echo 'Testing is disabled - No Android Robocop for you'
endif

ifdef MOZ_ANDROID_PACKAGE_INSTALL_BOUNCER
INNER_INSTALL_BOUNCER_PACKAGE=true
ifdef ENABLE_TESTS
UPLOAD_EXTRA_FILES += bouncer.apk

bouncer_package=$(ABS_DIST)/bouncer.apk

# Package and release sign the install bouncer APK.  This assumes that the main
# APK (that is, $(PACKAGE)) has already been produced, and verifies that the
# bouncer APK and the main APK define the same set of permissions.  The
# intention is to avoid permission-related surprises when bouncing to the
# installation process in the Play Store.  N.b.: sort -u is Posix and saves
# invoking uniq separately.  diff -u is *not* Posix, so we only add -c.
INNER_INSTALL_BOUNCER_PACKAGE=\
  $(call RELEASE_SIGN_ANDROID_APK,$(topobjdir)/mobile/android/bouncer/bouncer-unsigned-unaligned.apk,$(bouncer_package)) && \
  ($(AAPT) dump permissions $(PACKAGE) | sort -u > $(PACKAGE).permissions && \
   $(AAPT) dump permissions $(bouncer_package) | sort -u > $(bouncer_package).permissions && \
   diff -c $(PACKAGE).permissions $(bouncer_package).permissions || \
   (echo "*** Error: The permissions of the bouncer package differ from the permissions of the main package.  Ensure the bouncer and main package Android manifests agree, rebuild mobile/android, and re-package." && exit 1))
else
INNER_INSTALL_BOUNCER_PACKAGE=echo 'Testing is disabled, so the install bouncer is disabled - No trampolines for you'
endif # ENABLE_TESTS
else
INNER_INSTALL_BOUNCER_PACKAGE=echo 'Install bouncer is disabled - No trampolines for you'
endif # MOZ_ANDROID_PACKAGE_INSTALL_BOUNCER

# We force build an ap_ that does not check dependencies below.
# Language repacks take advantage of this unchecked dependency ap_ to
# insert additional resources (translated strings) into the ap_
# without the build system's participation.  This can do the wrong
# thing if there are resource changes in between build time and
# package time.
PKG_SUFFIX = .apk

INNER_FENNEC_PACKAGE = \
  $(MAKE) -C $(GECKO_APP_AP_PATH) gecko-nodeps.ap_ && \
  $(PYTHON) -m mozbuild.action.package_fennec_apk \
    --verbose \
    --inputs \
      $(GECKO_APP_AP_PATH)/gecko-nodeps.ap_ \
    --omnijar $(MOZ_PKG_DIR)/$(OMNIJAR_NAME) \
    --classes-dex $(GECKO_APP_AP_PATH)/classes.dex \
    --lib-dirs $(MOZ_PKG_DIR)/lib \
    --assets-dirs $(MOZ_PKG_DIR)/assets \
    --features-dirs $(MOZ_PKG_DIR)/features \
    --root-files $(foreach f,$(ROOT_FILES),$(MOZ_PKG_DIR)/$(f)) \
    --output $(PACKAGE:.apk=-unsigned-unaligned.apk) && \
  $(call RELEASE_SIGN_ANDROID_APK,$(PACKAGE:.apk=-unsigned-unaligned.apk),$(PACKAGE))

# Packaging produces many optional artifacts.
package_fennec = \
  $(INNER_FENNEC_PACKAGE) && \
  $(INNER_ROBOCOP_PACKAGE) && \
  $(INNER_INSTALL_BOUNCER_PACKAGE)

# Re-packaging only replaces Android resources and the omnijar before
# (re-)signing.
repackage_fennec = \
  $(MAKE) -C $(GECKO_APP_AP_PATH) gecko-nodeps.ap_ && \
  $(PYTHON) -m mozbuild.action.package_fennec_apk \
    --verbose \
    --inputs \
      $(UNPACKAGE) \
      $(GECKO_APP_AP_PATH)/gecko-nodeps.ap_ \
    --omnijar $(MOZ_PKG_DIR)/$(OMNIJAR_NAME) \
    --output $(PACKAGE:.apk=-unsigned-unaligned.apk) && \
  $(call RELEASE_SIGN_ANDROID_APK,$(PACKAGE:.apk=-unsigned-unaligned.apk),$(PACKAGE))

INNER_MAKE_PACKAGE = $(if $(UNPACKAGE),$(repackage_fennec),$(package_fennec))

INNER_UNMAKE_PACKAGE = \
  mkdir $(MOZ_PKG_DIR) && \
  ( cd $(MOZ_PKG_DIR) && \
    $(UNZIP) $(UNPACKAGE) $(ROOT_FILES) $(OMNIJAR_NAME) )
