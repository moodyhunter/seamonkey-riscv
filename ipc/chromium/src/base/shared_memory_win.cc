/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
// Copyright (c) 2006-2008 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "base/shared_memory.h"

#include "base/logging.h"
#include "base/win_util.h"
#include "base/string_util.h"
#include "mozilla/ipc/ProtocolUtils.h"

namespace {
// NtQuerySection is an internal (but believed to be stable) API and the
// structures it uses are defined in nt_internals.h.
// So we have to define them ourselves.
typedef enum _SECTION_INFORMATION_CLASS {
  SectionBasicInformation,
} SECTION_INFORMATION_CLASS;

typedef struct _SECTION_BASIC_INFORMATION {
  PVOID BaseAddress;
  ULONG Attributes;
  LARGE_INTEGER Size;
} SECTION_BASIC_INFORMATION, *PSECTION_BASIC_INFORMATION;

typedef ULONG(__stdcall* NtQuerySectionType)(
    HANDLE SectionHandle,
    SECTION_INFORMATION_CLASS SectionInformationClass,
    PVOID SectionInformation,
    ULONG SectionInformationLength,
    PULONG ResultLength);

// Checks if the section object is safe to map. At the moment this just means
// it's not an image section.
bool IsSectionSafeToMap(HANDLE handle) {
  static NtQuerySectionType nt_query_section_func =
    reinterpret_cast<NtQuerySectionType>(
      ::GetProcAddress(::GetModuleHandle(L"ntdll.dll"), "NtQuerySection"));
  DCHECK(nt_query_section_func);

  // The handle must have SECTION_QUERY access for this to succeed.
  SECTION_BASIC_INFORMATION basic_information = {};
  ULONG status =
      nt_query_section_func(handle, SectionBasicInformation, &basic_information,
                            sizeof(basic_information), nullptr);
  if (status) {
    return false;
  }

  return (basic_information.Attributes & SEC_IMAGE) != SEC_IMAGE;
}

} // namespace (unnamed)

namespace base {

SharedMemory::SharedMemory()
    : external_section_(false),
      mapped_file_(NULL),
      memory_(NULL),
      read_only_(false),
      max_size_(0),
      lock_(NULL) {
}

SharedMemory::~SharedMemory() {
  external_section_ = true;
  Close();
  if (lock_ != NULL)
    CloseHandle(lock_);
}

bool SharedMemory::SetHandle(SharedMemoryHandle handle, bool read_only) {
  DCHECK(mapped_file_ == NULL);

  external_section_ = true;
  mapped_file_ = handle;
  read_only_ = read_only;
  return true;
}

// static
bool SharedMemory::IsHandleValid(const SharedMemoryHandle& handle) {
  return handle != NULL;
}

// static
SharedMemoryHandle SharedMemory::NULLHandle() {
  return NULL;
}

bool SharedMemory::Create(const std::string &cname, bool read_only,
                          bool open_existing, size_t size) {
  DCHECK(mapped_file_ == NULL);
  std::wstring name = UTF8ToWide(cname);
  name_ = name;
  read_only_ = read_only;
  mapped_file_ = CreateFileMapping(INVALID_HANDLE_VALUE, NULL,
      read_only_ ? PAGE_READONLY : PAGE_READWRITE, 0, static_cast<DWORD>(size),
      name.empty() ? NULL : name.c_str());
  if (!mapped_file_)
    return false;

  // Check if the shared memory pre-exists.
  if (GetLastError() == ERROR_ALREADY_EXISTS && !open_existing) {
    Close();
    return false;
  }
  max_size_ = size;
  return true;
}

bool SharedMemory::Delete(const std::wstring& name) {
  // intentionally empty -- there is nothing for us to do on Windows.
  return true;
}

bool SharedMemory::Open(const std::wstring &name, bool read_only) {
  DCHECK(mapped_file_ == NULL);

  name_ = name;
  read_only_ = read_only;
  mapped_file_ = OpenFileMapping(
      read_only_ ? FILE_MAP_READ : FILE_MAP_ALL_ACCESS, false,
      name.empty() ? NULL : name.c_str());
  if (mapped_file_ != NULL) {
    // Note: size_ is not set in this case.
    return true;
  }
  return false;
}

bool SharedMemory::Map(size_t bytes) {
  if (mapped_file_ == NULL)
    return false;

  if (external_section_ && !IsSectionSafeToMap(mapped_file_)) {
    return false;
  }

  memory_ = MapViewOfFile(mapped_file_,
      read_only_ ? FILE_MAP_READ : FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, bytes);
  if (memory_ != NULL) {
    return true;
  }
  return false;
}

bool SharedMemory::Unmap() {
  if (memory_ == NULL)
    return false;

  UnmapViewOfFile(memory_);
  memory_ = NULL;
  return true;
}

bool SharedMemory::ShareToProcessCommon(ProcessId processId,
                                        SharedMemoryHandle *new_handle,
                                        bool close_self) {
  *new_handle = 0;
  DWORD access = FILE_MAP_READ | SECTION_QUERY;
  DWORD options = 0;
  HANDLE mapped_file = mapped_file_;
  HANDLE result;
  if (!read_only_)
    access |= FILE_MAP_WRITE;
  if (close_self) {
    // DUPLICATE_CLOSE_SOURCE causes DuplicateHandle to close mapped_file.
    options = DUPLICATE_CLOSE_SOURCE;
    mapped_file_ = NULL;
    Unmap();
  }

  if (processId == GetCurrentProcId() && close_self) {
    *new_handle = mapped_file;
    return true;
  }

  if (!mozilla::ipc::DuplicateHandle(mapped_file, processId, &result, access,
                                     options)) {
    return false;
  }

  *new_handle = result;
  return true;
}


void SharedMemory::Close(bool unmap_view) {
  if (unmap_view) {
    Unmap();
  }

  if (mapped_file_ != NULL) {
    CloseHandle(mapped_file_);
    mapped_file_ = NULL;
  }
}

void SharedMemory::Lock() {
  if (lock_ == NULL) {
    std::wstring name = name_;
    name.append(L"lock");
    lock_ = CreateMutex(NULL, FALSE, name.c_str());
    DCHECK(lock_ != NULL);
    if (lock_ == NULL) {
      DLOG(ERROR) << "Could not create mutex" << GetLastError();
      return;  // there is nothing good we can do here.
    }
  }
  WaitForSingleObject(lock_, INFINITE);
}

void SharedMemory::Unlock() {
  DCHECK(lock_ != NULL);
  ReleaseMutex(lock_);
}

SharedMemoryHandle SharedMemory::handle() const {
  return mapped_file_;
}

}  // namespace base
