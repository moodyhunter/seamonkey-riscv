//
// Copyright 2014 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//

// TextureD3D.h: Implementations of the Texture interfaces shared betweeen the D3D backends.

#ifndef LIBANGLE_RENDERER_D3D_TEXTURED3D_H_
#define LIBANGLE_RENDERER_D3D_TEXTURED3D_H_

#include "common/Color.h"
#include "libANGLE/Constants.h"
#include "libANGLE/Stream.h"
#include "libANGLE/angletypes.h"
#include "libANGLE/renderer/TextureImpl.h"
#include "libANGLE/renderer/d3d/TextureStorage.h"

namespace gl
{
class Framebuffer;
}

namespace rx
{
class EGLImageD3D;
class ImageD3D;
class RendererD3D;
class RenderTargetD3D;
class TextureStorage;

class TextureD3D : public TextureImpl
{
  public:
    TextureD3D(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D() override;

    gl::Error onDestroy(const gl::Context *context) override;

    angle::Result getNativeTexture(const gl::Context *context, TextureStorage **outStorage);

    bool hasDirtyImages() const { return mDirtyImages; }
    void resetDirty() { mDirtyImages = false; }

    virtual ImageD3D *getImage(const gl::ImageIndex &index) const = 0;
    virtual GLsizei getLayerCount(int level) const = 0;

    angle::Result getImageAndSyncFromStorage(const gl::Context *context,
                                             const gl::ImageIndex &index,
                                             ImageD3D **outImage);

    GLint getBaseLevelWidth() const;
    GLint getBaseLevelHeight() const;
    GLenum getBaseLevelInternalFormat() const;

    gl::Error setStorage(const gl::Context *context,
                         gl::TextureType type,
                         size_t levels,
                         GLenum internalFormat,
                         const gl::Extents &size) override;

    gl::Error setStorageMultisample(const gl::Context *context,
                                    gl::TextureType type,
                                    GLsizei samples,
                                    GLint internalFormat,
                                    const gl::Extents &size,
                                    bool fixedSampleLocations) override;

    bool isImmutable() const { return mImmutable; }

    virtual gl::Error getRenderTarget(const gl::Context *context,
                                      const gl::ImageIndex &index,
                                      RenderTargetD3D **outRT) = 0;

    // Returns an iterator over all "Images" for this particular Texture.
    virtual gl::ImageIndexIterator imageIterator() const = 0;

    // Returns an ImageIndex for a particular "Image". 3D Textures do not have images for
    // slices of their depth texures, so 3D textures ignore the layer parameter.
    virtual gl::ImageIndex getImageIndex(GLint mip, GLint layer) const = 0;
    virtual bool isValidIndex(const gl::ImageIndex &index) const = 0;

    gl::Error setImageExternal(const gl::Context *context,
                               gl::TextureType type,
                               egl::Stream *stream,
                               const egl::Stream::GLTextureDescription &desc) override;
    gl::Error generateMipmap(const gl::Context *context) override;
    TextureStorage *getStorage();
    ImageD3D *getBaseLevelImage() const;

    gl::Error getAttachmentRenderTarget(const gl::Context *context,
                                        GLenum binding,
                                        const gl::ImageIndex &imageIndex,
                                        FramebufferAttachmentRenderTarget **rtOut) override;

    gl::Error setBaseLevel(const gl::Context *context, GLuint baseLevel) override;

    gl::Error syncState(const gl::Context *context,
                        const gl::Texture::DirtyBits &dirtyBits) override;

    gl::Error initializeContents(const gl::Context *context,
                                 const gl::ImageIndex &imageIndex) override;

  protected:
    angle::Result setImageImpl(const gl::Context *context,
                               const gl::ImageIndex &index,
                               GLenum type,
                               const gl::PixelUnpackState &unpack,
                               const uint8_t *pixels,
                               ptrdiff_t layerOffset);
    angle::Result subImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Box &area,
                           GLenum format,
                           GLenum type,
                           const gl::PixelUnpackState &unpack,
                           gl::Buffer *unpackBuffer,
                           const uint8_t *pixels,
                           ptrdiff_t layerOffset);
    angle::Result setCompressedImageImpl(const gl::Context *context,
                                         const gl::ImageIndex &index,
                                         const gl::PixelUnpackState &unpack,
                                         const uint8_t *pixels,
                                         ptrdiff_t layerOffset);
    angle::Result subImageCompressed(const gl::Context *context,
                                     const gl::ImageIndex &index,
                                     const gl::Box &area,
                                     GLenum format,
                                     const gl::PixelUnpackState &unpack,
                                     const uint8_t *pixels,
                                     ptrdiff_t layerOffset);
    bool isFastUnpackable(const gl::Buffer *unpackBuffer, GLenum sizedInternalFormat);
    angle::Result fastUnpackPixels(const gl::Context *context,
                                   const gl::PixelUnpackState &unpack,
                                   const uint8_t *pixels,
                                   const gl::Box &destArea,
                                   GLenum sizedInternalFormat,
                                   GLenum type,
                                   RenderTargetD3D *destRenderTarget);

    GLint getLevelZeroWidth() const;
    GLint getLevelZeroHeight() const;
    virtual GLint getLevelZeroDepth() const;

    GLint creationLevels(GLsizei width, GLsizei height, GLsizei depth) const;
    virtual angle::Result initMipmapImages(const gl::Context *context) = 0;
    bool isBaseImageZeroSize() const;
    virtual bool isImageComplete(const gl::ImageIndex &index) const = 0;

    bool canCreateRenderTargetForImage(const gl::ImageIndex &index) const;
    angle::Result ensureRenderTarget(const gl::Context *context);

    virtual angle::Result createCompleteStorage(bool renderTarget,
                                                TexStoragePointer *outTexStorage) const = 0;
    virtual angle::Result setCompleteTexStorage(const gl::Context *context,
                                                TextureStorage *newCompleteTexStorage)  = 0;
    angle::Result commitRegion(const gl::Context *context,
                               const gl::ImageIndex &index,
                               const gl::Box &region);

    angle::Result releaseTexStorage(const gl::Context *context);

    GLuint getBaseLevel() const { return mBaseLevel; };

    virtual void markAllImagesDirty() = 0;

    GLint getBaseLevelDepth() const;

    RendererD3D *mRenderer;

    bool mDirtyImages;

    bool mImmutable;
    TextureStorage *mTexStorage;

  private:
    virtual angle::Result initializeStorage(const gl::Context *context, bool renderTarget) = 0;

    virtual angle::Result updateStorage(const gl::Context *context) = 0;

    bool shouldUseSetData(const ImageD3D *image) const;

    angle::Result generateMipmapUsingImages(const gl::Context *context, const GLuint maxLevel);

    GLuint mBaseLevel;
};

class TextureD3D_2D : public TextureD3D
{
  public:
    TextureD3D_2D(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_2D() override;

    gl::Error onDestroy(const gl::Context *context) override;

    ImageD3D *getImage(int level, int layer) const;
    ImageD3D *getImage(const gl::ImageIndex &index) const override;
    GLsizei getLayerCount(int level) const override;

    GLsizei getWidth(GLint level) const;
    GLsizei getHeight(GLint level) const;
    GLenum getInternalFormat(GLint level) const;
    bool isDepth(GLint level) const;
    bool isSRGB(GLint level) const;

    gl::Error setImage(const gl::Context *context,
                       const gl::ImageIndex &index,
                       GLenum internalFormat,
                       const gl::Extents &size,
                       GLenum format,
                       GLenum type,
                       const gl::PixelUnpackState &unpack,
                       const uint8_t *pixels) override;
    gl::Error setSubImage(const gl::Context *context,
                          const gl::ImageIndex &index,
                          const gl::Box &area,
                          GLenum format,
                          GLenum type,
                          const gl::PixelUnpackState &unpack,
                          gl::Buffer *unpackBuffer,
                          const uint8_t *pixels) override;

    gl::Error setCompressedImage(const gl::Context *context,
                                 const gl::ImageIndex &index,
                                 GLenum internalFormat,
                                 const gl::Extents &size,
                                 const gl::PixelUnpackState &unpack,
                                 size_t imageSize,
                                 const uint8_t *pixels) override;
    gl::Error setCompressedSubImage(const gl::Context *context,
                                    const gl::ImageIndex &index,
                                    const gl::Box &area,
                                    GLenum format,
                                    const gl::PixelUnpackState &unpack,
                                    size_t imageSize,
                                    const uint8_t *pixels) override;

    gl::Error copyImage(const gl::Context *context,
                        const gl::ImageIndex &index,
                        const gl::Rectangle &sourceArea,
                        GLenum internalFormat,
                        gl::Framebuffer *source) override;
    gl::Error copySubImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Offset &destOffset,
                           const gl::Rectangle &sourceArea,
                           gl::Framebuffer *source) override;

    gl::Error copyTexture(const gl::Context *context,
                          const gl::ImageIndex &index,
                          GLenum internalFormat,
                          GLenum type,
                          size_t sourceLevel,
                          bool unpackFlipY,
                          bool unpackPremultiplyAlpha,
                          bool unpackUnmultiplyAlpha,
                          const gl::Texture *source) override;
    gl::Error copySubTexture(const gl::Context *context,
                             const gl::ImageIndex &index,
                             const gl::Offset &destOffset,
                             size_t sourceLevel,
                             const gl::Rectangle &sourceArea,
                             bool unpackFlipY,
                             bool unpackPremultiplyAlpha,
                             bool unpackUnmultiplyAlpha,
                             const gl::Texture *source) override;
    gl::Error copyCompressedTexture(const gl::Context *context, const gl::Texture *source) override;

    gl::Error setStorage(const gl::Context *context,
                         gl::TextureType type,
                         size_t levels,
                         GLenum internalFormat,
                         const gl::Extents &size) override;

    gl::Error bindTexImage(const gl::Context *context, egl::Surface *surface) override;
    gl::Error releaseTexImage(const gl::Context *context) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

  protected:
    void markAllImagesDirty() override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outTexStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isValidLevel(int level) const;
    bool isLevelComplete(int level) const;
    bool isImageComplete(const gl::ImageIndex &index) const override;

    angle::Result updateStorageLevel(const gl::Context *context, int level);

    angle::Result redefineImage(const gl::Context *context,
                                size_t level,
                                GLenum internalformat,
                                const gl::Extents &size,
                                bool forceRelease);

    bool mEGLImageTarget;
    gl::TexLevelArray<std::unique_ptr<ImageD3D>> mImageArray;
};

class TextureD3D_Cube : public TextureD3D
{
  public:
    TextureD3D_Cube(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_Cube() override;

    gl::Error onDestroy(const gl::Context *context) override;

    ImageD3D *getImage(int level, int layer) const;
    ImageD3D *getImage(const gl::ImageIndex &index) const override;
    GLsizei getLayerCount(int level) const override;

    GLenum getInternalFormat(GLint level, GLint layer) const;
    bool isDepth(GLint level, GLint layer) const;
    bool isSRGB(GLint level, GLint layer) const;

    gl::Error setImage(const gl::Context *context,
                       const gl::ImageIndex &index,
                       GLenum internalFormat,
                       const gl::Extents &size,
                       GLenum format,
                       GLenum type,
                       const gl::PixelUnpackState &unpack,
                       const uint8_t *pixels) override;
    gl::Error setSubImage(const gl::Context *context,
                          const gl::ImageIndex &index,
                          const gl::Box &area,
                          GLenum format,
                          GLenum type,
                          const gl::PixelUnpackState &unpack,
                          gl::Buffer *unpackBuffer,
                          const uint8_t *pixels) override;

    gl::Error setCompressedImage(const gl::Context *context,
                                 const gl::ImageIndex &index,
                                 GLenum internalFormat,
                                 const gl::Extents &size,
                                 const gl::PixelUnpackState &unpack,
                                 size_t imageSize,
                                 const uint8_t *pixels) override;
    gl::Error setCompressedSubImage(const gl::Context *context,
                                    const gl::ImageIndex &index,
                                    const gl::Box &area,
                                    GLenum format,
                                    const gl::PixelUnpackState &unpack,
                                    size_t imageSize,
                                    const uint8_t *pixels) override;

    gl::Error copyImage(const gl::Context *context,
                        const gl::ImageIndex &index,
                        const gl::Rectangle &sourceArea,
                        GLenum internalFormat,
                        gl::Framebuffer *source) override;
    gl::Error copySubImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Offset &destOffset,
                           const gl::Rectangle &sourceArea,
                           gl::Framebuffer *source) override;

    gl::Error copyTexture(const gl::Context *context,
                          const gl::ImageIndex &index,
                          GLenum internalFormat,
                          GLenum type,
                          size_t sourceLevel,
                          bool unpackFlipY,
                          bool unpackPremultiplyAlpha,
                          bool unpackUnmultiplyAlpha,
                          const gl::Texture *source) override;
    gl::Error copySubTexture(const gl::Context *context,
                             const gl::ImageIndex &index,
                             const gl::Offset &destOffset,
                             size_t sourceLevel,
                             const gl::Rectangle &sourceArea,
                             bool unpackFlipY,
                             bool unpackPremultiplyAlpha,
                             bool unpackUnmultiplyAlpha,
                             const gl::Texture *source) override;

    gl::Error setStorage(const gl::Context *context,
                         gl::TextureType type,
                         size_t levels,
                         GLenum internalFormat,
                         const gl::Extents &size) override;

    gl::Error bindTexImage(const gl::Context *context, egl::Surface *surface) override;
    gl::Error releaseTexImage(const gl::Context *context) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

  protected:
    void markAllImagesDirty() override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outTexStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isValidFaceLevel(int faceIndex, int level) const;
    bool isFaceLevelComplete(int faceIndex, int level) const;
    bool isCubeComplete() const;
    bool isImageComplete(const gl::ImageIndex &index) const override;
    angle::Result updateStorageFaceLevel(const gl::Context *context, int faceIndex, int level);

    angle::Result redefineImage(const gl::Context *context,
                                int faceIndex,
                                GLint level,
                                GLenum internalformat,
                                const gl::Extents &size,
                                bool forceRelease);

    std::array<gl::TexLevelArray<std::unique_ptr<ImageD3D>>, 6> mImageArray;
};

class TextureD3D_3D : public TextureD3D
{
  public:
    TextureD3D_3D(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_3D() override;

    gl::Error onDestroy(const gl::Context *context) override;

    ImageD3D *getImage(int level, int layer) const;
    ImageD3D *getImage(const gl::ImageIndex &index) const override;
    GLsizei getLayerCount(int level) const override;

    GLsizei getWidth(GLint level) const;
    GLsizei getHeight(GLint level) const;
    GLsizei getDepth(GLint level) const;
    GLenum getInternalFormat(GLint level) const;
    bool isDepth(GLint level) const;

    gl::Error setImage(const gl::Context *context,
                       const gl::ImageIndex &index,
                       GLenum internalFormat,
                       const gl::Extents &size,
                       GLenum format,
                       GLenum type,
                       const gl::PixelUnpackState &unpack,
                       const uint8_t *pixels) override;
    gl::Error setSubImage(const gl::Context *context,
                          const gl::ImageIndex &index,
                          const gl::Box &area,
                          GLenum format,
                          GLenum type,
                          const gl::PixelUnpackState &unpack,
                          gl::Buffer *unpackBuffer,
                          const uint8_t *pixels) override;

    gl::Error setCompressedImage(const gl::Context *context,
                                 const gl::ImageIndex &index,
                                 GLenum internalFormat,
                                 const gl::Extents &size,
                                 const gl::PixelUnpackState &unpack,
                                 size_t imageSize,
                                 const uint8_t *pixels) override;
    gl::Error setCompressedSubImage(const gl::Context *context,
                                    const gl::ImageIndex &index,
                                    const gl::Box &area,
                                    GLenum format,
                                    const gl::PixelUnpackState &unpack,
                                    size_t imageSize,
                                    const uint8_t *pixels) override;

    gl::Error copyImage(const gl::Context *context,
                        const gl::ImageIndex &index,
                        const gl::Rectangle &sourceArea,
                        GLenum internalFormat,
                        gl::Framebuffer *source) override;
    gl::Error copySubImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Offset &destOffset,
                           const gl::Rectangle &sourceArea,
                           gl::Framebuffer *source) override;

    gl::Error setStorage(const gl::Context *context,
                         gl::TextureType type,
                         size_t levels,
                         GLenum internalFormat,
                         const gl::Extents &size) override;

    gl::Error bindTexImage(const gl::Context *context, egl::Surface *surface) override;
    gl::Error releaseTexImage(const gl::Context *context) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

  protected:
    void markAllImagesDirty() override;
    GLint getLevelZeroDepth() const override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isValidLevel(int level) const;
    bool isLevelComplete(int level) const;
    bool isImageComplete(const gl::ImageIndex &index) const override;
    angle::Result updateStorageLevel(const gl::Context *context, int level);

    angle::Result redefineImage(const gl::Context *context,
                                GLint level,
                                GLenum internalformat,
                                const gl::Extents &size,
                                bool forceRelease);

    gl::TexLevelArray<std::unique_ptr<ImageD3D>> mImageArray;
};

class TextureD3D_2DArray : public TextureD3D
{
  public:
    TextureD3D_2DArray(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_2DArray() override;

    gl::Error onDestroy(const gl::Context *context) override;

    virtual ImageD3D *getImage(int level, int layer) const;
    ImageD3D *getImage(const gl::ImageIndex &index) const override;
    GLsizei getLayerCount(int level) const override;

    GLsizei getWidth(GLint level) const;
    GLsizei getHeight(GLint level) const;
    GLenum getInternalFormat(GLint level) const;
    bool isDepth(GLint level) const;

    gl::Error setImage(const gl::Context *context,
                       const gl::ImageIndex &index,
                       GLenum internalFormat,
                       const gl::Extents &size,
                       GLenum format,
                       GLenum type,
                       const gl::PixelUnpackState &unpack,
                       const uint8_t *pixels) override;
    gl::Error setSubImage(const gl::Context *context,
                          const gl::ImageIndex &index,
                          const gl::Box &area,
                          GLenum format,
                          GLenum type,
                          const gl::PixelUnpackState &unpack,
                          gl::Buffer *unpackBuffer,
                          const uint8_t *pixels) override;

    gl::Error setCompressedImage(const gl::Context *context,
                                 const gl::ImageIndex &index,
                                 GLenum internalFormat,
                                 const gl::Extents &size,
                                 const gl::PixelUnpackState &unpack,
                                 size_t imageSize,
                                 const uint8_t *pixels) override;
    gl::Error setCompressedSubImage(const gl::Context *context,
                                    const gl::ImageIndex &index,
                                    const gl::Box &area,
                                    GLenum format,
                                    const gl::PixelUnpackState &unpack,
                                    size_t imageSize,
                                    const uint8_t *pixels) override;

    gl::Error copyImage(const gl::Context *context,
                        const gl::ImageIndex &index,
                        const gl::Rectangle &sourceArea,
                        GLenum internalFormat,
                        gl::Framebuffer *source) override;
    gl::Error copySubImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Offset &destOffset,
                           const gl::Rectangle &sourceArea,
                           gl::Framebuffer *source) override;

    gl::Error setStorage(const gl::Context *context,
                         gl::TextureType type,
                         size_t levels,
                         GLenum internalFormat,
                         const gl::Extents &size) override;

    gl::Error bindTexImage(const gl::Context *context, egl::Surface *surface) override;
    gl::Error releaseTexImage(const gl::Context *context) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

  protected:
    void markAllImagesDirty() override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isValidLevel(int level) const;
    bool isLevelComplete(int level) const;
    bool isImageComplete(const gl::ImageIndex &index) const override;
    angle::Result updateStorageLevel(const gl::Context *context, int level);

    void deleteImages();
    angle::Result redefineImage(const gl::Context *context,
                                GLint level,
                                GLenum internalformat,
                                const gl::Extents &size,
                                bool forceRelease);

    // Storing images as an array of single depth textures since D3D11 treats each array level of a
    // Texture2D object as a separate subresource.  Each layer would have to be looped over
    // to update all the texture layers since they cannot all be updated at once and it makes the most
    // sense for the Image class to not have to worry about layer subresource as well as mip subresources.
    GLsizei mLayerCounts[gl::IMPLEMENTATION_MAX_TEXTURE_LEVELS];
    ImageD3D **mImageArray[gl::IMPLEMENTATION_MAX_TEXTURE_LEVELS];
};

// Base class for immutable textures. These don't support manipulation of individual texture images.
class TextureD3DImmutableBase : public TextureD3D
{
  public:
    TextureD3DImmutableBase(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3DImmutableBase() override;

    ImageD3D *getImage(const gl::ImageIndex &index) const override;
    gl::Error setImage(const gl::Context *context,
                       const gl::ImageIndex &index,
                       GLenum internalFormat,
                       const gl::Extents &size,
                       GLenum format,
                       GLenum type,
                       const gl::PixelUnpackState &unpack,
                       const uint8_t *pixels) override;
    gl::Error setSubImage(const gl::Context *context,
                          const gl::ImageIndex &index,
                          const gl::Box &area,
                          GLenum format,
                          GLenum type,
                          const gl::PixelUnpackState &unpack,
                          gl::Buffer *unpackBuffer,
                          const uint8_t *pixels) override;

    gl::Error setCompressedImage(const gl::Context *context,
                                 const gl::ImageIndex &index,
                                 GLenum internalFormat,
                                 const gl::Extents &size,
                                 const gl::PixelUnpackState &unpack,
                                 size_t imageSize,
                                 const uint8_t *pixels) override;
    gl::Error setCompressedSubImage(const gl::Context *context,
                                    const gl::ImageIndex &index,
                                    const gl::Box &area,
                                    GLenum format,
                                    const gl::PixelUnpackState &unpack,
                                    size_t imageSize,
                                    const uint8_t *pixels) override;

    gl::Error copyImage(const gl::Context *context,
                        const gl::ImageIndex &index,
                        const gl::Rectangle &sourceArea,
                        GLenum internalFormat,
                        gl::Framebuffer *source) override;
    gl::Error copySubImage(const gl::Context *context,
                           const gl::ImageIndex &index,
                           const gl::Offset &destOffset,
                           const gl::Rectangle &sourceArea,
                           gl::Framebuffer *source) override;

    gl::Error bindTexImage(const gl::Context *context, egl::Surface *surface) override;
    gl::Error releaseTexImage(const gl::Context *context) override;
};

class TextureD3D_External : public TextureD3DImmutableBase
{
  public:
    TextureD3D_External(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_External() override;

    GLsizei getLayerCount(int level) const override;

    gl::Error setImageExternal(const gl::Context *context,
                               gl::TextureType type,
                               egl::Stream *stream,
                               const egl::Stream::GLTextureDescription &desc) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

  protected:
    void markAllImagesDirty() override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outTexStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isImageComplete(const gl::ImageIndex &index) const override;
};

class TextureD3D_2DMultisample : public TextureD3DImmutableBase
{
  public:
    TextureD3D_2DMultisample(const gl::TextureState &data, RendererD3D *renderer);
    ~TextureD3D_2DMultisample() override;

    gl::Error setStorageMultisample(const gl::Context *context,
                                    gl::TextureType type,
                                    GLsizei samples,
                                    GLint internalFormat,
                                    const gl::Extents &size,
                                    bool fixedSampleLocations) override;

    gl::Error setEGLImageTarget(const gl::Context *context,
                                gl::TextureType type,
                                egl::Image *image) override;

    gl::Error getRenderTarget(const gl::Context *context,
                              const gl::ImageIndex &index,
                              RenderTargetD3D **outRT) override;

    gl::ImageIndexIterator imageIterator() const override;
    gl::ImageIndex getImageIndex(GLint mip, GLint layer) const override;
    bool isValidIndex(const gl::ImageIndex &index) const override;

    GLsizei getLayerCount(int level) const override;

  protected:
    void markAllImagesDirty() override;

  private:
    angle::Result initializeStorage(const gl::Context *context, bool renderTarget) override;
    angle::Result createCompleteStorage(bool renderTarget,
                                        TexStoragePointer *outTexStorage) const override;
    angle::Result setCompleteTexStorage(const gl::Context *context,
                                        TextureStorage *newCompleteTexStorage) override;

    angle::Result updateStorage(const gl::Context *context) override;
    angle::Result initMipmapImages(const gl::Context *context) override;

    bool isImageComplete(const gl::ImageIndex &index) const override;
};
}

#endif // LIBANGLE_RENDERER_D3D_TEXTURED3D_H_
