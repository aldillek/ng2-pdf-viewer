import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NpxPdfViewer2Component } from './npx-pdf-viewer2.component';

describe('NpxPdfViewer2Component', () => {
  let component: NpxPdfViewer2Component;
  let fixture: ComponentFixture<NpxPdfViewer2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NpxPdfViewer2Component],
    }).compileComponents();

    fixture = TestBed.createComponent(NpxPdfViewer2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
