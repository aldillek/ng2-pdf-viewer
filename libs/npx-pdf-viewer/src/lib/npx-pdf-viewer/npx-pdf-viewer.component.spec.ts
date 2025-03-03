import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NpxPdfViewerComponent } from './npx-pdf-viewer.component';

describe('NpxPdfViewerComponent', () => {
  let component: NpxPdfViewerComponent;
  let fixture: ComponentFixture<NpxPdfViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NpxPdfViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NpxPdfViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
