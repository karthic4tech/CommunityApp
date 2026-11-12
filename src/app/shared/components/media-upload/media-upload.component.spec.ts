import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MediaService } from '../../../core/services/media.service';
import { LanguageService } from '../../../core/services/language.service';
import { MediaUploadComponent } from './media-upload.component';

describe('MediaUploadComponent mobile image actions', () => {
  const media = {
    validateFileType: vi.fn(),
    validateFileSize: vi.fn(),
    validateImageDimensions: vi.fn(),
    getMediaGallery: vi.fn(),
    uploadImage: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    media.validateImageDimensions.mockResolvedValue({ width: 640, height: 480 });
    media.getMediaGallery.mockResolvedValue([]);
    TestBed.configureTestingModule({
      imports: [MediaUploadComponent],
      providers: [{ provide: MediaService, useValue: media }],
    });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  function selectedFiles(files: File[], isCamera = false): Event {
    const target = {
      files,
      value: 'selected',
      hasAttribute: (name: string) => isCamera && name === 'capture',
    };
    return { target } as unknown as Event;
  }

  it('renders separate rear-camera and multiple-gallery inputs', async () => {
    const fixture = TestBed.createComponent(MediaUploadComponent);
    fixture.componentRef.setInput('entityType', 'listing');
    fixture.componentRef.setInput('entityId', '');
    fixture.componentRef.setInput('showCameraActions', true);
    fixture.componentRef.setInput('allowPreview', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[capture="environment"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[multiple]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Take Photo');
    expect(fixture.nativeElement.textContent).toContain('Choose Photos');
    fixture.destroy();
  });

  it('sends camera and gallery files through the same validation and stages them until a listing exists', async () => {
    const fixture = TestBed.createComponent(MediaUploadComponent);
    fixture.componentRef.setInput('entityType', 'listing');
    fixture.componentRef.setInput('entityId', '');
    fixture.componentRef.setInput('showCameraActions', true);
    fixture.componentRef.setInput('allowPreview', false);
    fixture.componentRef.setInput('autoUpload', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as {
      onCameraSelected(event: Event): Promise<void>;
      onGallerySelected(event: Event): Promise<void>;
    };
    const cameraPhoto = new File(['camera'], 'camera.jpg', { type: 'image/jpeg', lastModified: 10 });
    const galleryPhoto = new File(['gallery'], 'gallery.png', { type: 'image/png', lastModified: 20 });
    await component.onCameraSelected(selectedFiles([cameraPhoto], true));
    await component.onGallerySelected(selectedFiles([cameraPhoto, galleryPhoto]));
    fixture.detectChanges();

    expect(media.validateFileType).toHaveBeenCalledTimes(2);
    expect(media.validateImageDimensions).toHaveBeenCalledTimes(2);
    expect(media.uploadImage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.draft').length).toBe(2);
    fixture.destroy();
  });
});
