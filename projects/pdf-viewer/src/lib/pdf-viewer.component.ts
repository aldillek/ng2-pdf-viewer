/**
 * Created by vadimdez on 21/06/16.
 */
import {
  Component,
  Input,
  ElementRef,
  OnChanges,
  SimpleChanges,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  NgZone,
  input,
  booleanAttribute,
  output,
  viewChild,
} from '@angular/core';
import { from, fromEvent, Subject } from 'rxjs';
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import {
  version,
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
import * as PDFJS from 'pdfjs-dist';
import * as PDFJSViewer from 'pdfjs-dist/web/pdf_viewer.mjs';
import { LinkTarget } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { createEventBus } from '../utils/event-bus-utils';
import { assign, isSSR } from '../utils/helpers';
import type {
  PDFSource,
  PDFProgressData,
  PDFDocumentLoadingTask,
  PDFViewerOptions,
  ZoomScale,
} from '../utils/typings';
import { BORDER_WIDTH, CSS_UNITS } from '../utils/constants';

if (!isSSR()) {
  // assign(PDFJS, 'verbosity', VerbosityLevel.INFOS);
}

// @ts-expect-error This does not exist outside of polyfill which this is doing
if (Promise.withResolvers === undefined && globalThis) {
  // @ts-expect-error This does not exist outside of polyfill which this is doing
  globalThis.Promise.withResolvers = () => {
    let resolve;
    let reject;
    const promise = new Promise((result, rej) => {
      resolve = result;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export enum RenderTextMode {
  DISABLED,
  ENABLED,
  ENHANCED,
}

@Component({
  selector: 'pdf-viewer',
  template: `
    <div #pdfViewerContainer class="ng2-pdf-viewer-container">
      <div class="pdfViewer"></div>
    </div>
  `,
  standalone: true,
  styleUrls: ['./pdf-viewer.component.scss'],
})
export class PdfViewerComponent
  implements OnChanges, OnInit, OnDestroy, AfterViewChecked
{
  pdfViewerContainer =
    viewChild.required<ElementRef<HTMLDivElement>>('pdfViewerContainer');
  public eventBus!: PDFJSViewer.EventBus;
  public pdfLinkService!: PDFJSViewer.PDFLinkService;
  public pdfFindController!: PDFJSViewer.PDFFindController;
  public pdfViewer!: PDFJSViewer.PDFViewer | PDFJSViewer.PDFSinglePageViewer;
  private isVisible = false;
  private _imageResourcesPath =
    PDFJS === undefined
      ? undefined
      : `https://unpkg.com/pdfjs-dist@${version}/web/images/`;
  private _pdf: PDFDocumentProxy | undefined;
  private lastLoaded!: string | Uint8Array | PDFSource | undefined;
  private _latestScrolledPage!: number;
  private pageScrollTimeout: number | undefined = undefined;
  private isInitialized = false;
  private loadingTask?: PDFDocumentLoadingTask | null;
  private destroy$ = new Subject<void>();
  afterLoadComplete = output<PDFDocumentProxy>({
    alias: 'after-load-complete',
  });
  pageRendered = output<CustomEvent>({ alias: 'page-rendered' });
  pageInitialized = output<CustomEvent>({ alias: 'pages-initialized' });
  textLayerRendered = output<CustomEvent>({ alias: 'text-layer-rendered' });
  onError = output<unknown>({ alias: 'error' });
  onProgress = output<PDFProgressData>({ alias: 'on-progress' });
  pageChange = output<number>({ alias: 'page-change' });
  src = input<PDFSource | string | Uint8Array | undefined>();
  cMapsUrl = input<string | undefined>(
    PDFJS === undefined
      ? undefined
      : `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
    { alias: 'c-maps-url' },
  );
  page = input<number, number>(1, {
    transform: (value: number | string) => {
      const originalPage =
        typeof value === 'number' ? value : Number.parseInt(value, 10) || 1;

      if (originalPage) {
        const pageBasedOnPdf = this.getValidPageNumber(originalPage);
        if (originalPage !== pageBasedOnPdf) {
          this.pageChange.emit(pageBasedOnPdf);
          return pageBasedOnPdf;
        }
      }
      return originalPage;
    },
  });
  renderText = input<boolean, boolean>(true, {
    alias: 'render-text',
    transform: booleanAttribute,
  });
  renderTextMode = input<RenderTextMode>(RenderTextMode.ENABLED, {
    alias: 'render-text-mode',
  });
  originalSize = input<boolean, boolean>(true, {
    alias: 'original-size',
    transform: booleanAttribute,
  });
  showAll = input<boolean, boolean>(true, {
    alias: 'show-all',
    transform: booleanAttribute,
  });
  stickToPage = input<boolean, boolean>(false, {
    alias: 'stick-to-page',
    transform: booleanAttribute,
  });
  zoom = input<number, number>(1, {
    transform: (value) => {
      if (value <= 0) {
        return 1;
      }
      return value;
    },
  });
  zoomScale = input<ZoomScale>('page-width', { alias: 'zoom-scale' });
  rotation = input<number, number>(0, {
    transform: (value: number) => {
      if (!(typeof value === 'number' && value % 90 === 0)) {
        console.warn('Invalid pages rotation angle.');
        return 0;
      }
      return value;
    },
  });
  externalLinkTarget = input<string>('blank', {
    alias: 'external-link-target',
  });
  autoresize = input<boolean, boolean>(true, {
    alias: 'autoresize',
    transform: booleanAttribute,
  });
  fitToPage = input<boolean, boolean>(false, {
    alias: 'fit-to-page',
    transform: booleanAttribute,
  });
  showBorders = input<boolean, boolean>(false, {
    alias: 'show-borders',
    transform: booleanAttribute,
  });

  static getLinkTarget(type: string) {
    switch (type) {
      default:
      case 'blank': {
        return LinkTarget.BLANK;
      }
      case 'none': {
        return LinkTarget.NONE;
      }
      case 'self': {
        return LinkTarget.SELF;
      }
      case 'parent': {
        return LinkTarget.PARENT;
      }
      case 'top': {
        return LinkTarget.TOP;
      }
    }
  }

  constructor(
    private element: ElementRef<HTMLElement>,
    private ngZone: NgZone,
  ) {
    if (isSSR()) {
      return;
    }

    let pdfWorkerSource: string;

    const pdfJsVersion: string = version;
    pdfWorkerSource = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/legacy/build/pdf.worker.min.mjs`;
    // const versionSpecificPdfWorkerUrl: string =
    //   globalThis[`pdfWorkerSrc${pdfJsVersion}`];

    // if (versionSpecificPdfWorkerUrl) {
    //   pdfWorkerSource = versionSpecificPdfWorkerUrl;
    // } else if (
    //   Object.prototype.hasOwnProperty.call(globalThis, 'pdfWorkerSrc') &&
    //   typeof (globalThis as any).pdfWorkerSrc === 'string' &&
    //   (globalThis as any).pdfWorkerSrc
    // ) {
    //   pdfWorkerSource = (globalThis as any).pdfWorkerSrc;
    // } else {
    //   pdfWorkerSource = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/legacy/build/pdf.worker.min.mjs`;
    // }

    assign(GlobalWorkerOptions, 'workerSrc', pdfWorkerSource);
  }

  ngAfterViewChecked(): void {
    if (this.isInitialized) {
      return;
    }

    const offset = this.pdfViewerContainer().nativeElement.offsetParent;

    if (this.isVisible === true && offset == undefined) {
      this.isVisible = false;
      return;
    }

    if (this.isVisible === false && offset != undefined) {
      this.isVisible = true;

      setTimeout(() => {
        this.initialize();
        this.ngOnChanges({ src: this.src() } as any);
      });
    }
  }

  ngOnInit() {
    this.initialize();
    this.setupResizeListener();
  }

  ngOnDestroy() {
    this.clear();
    this.destroy$.next();
    this.loadingTask = null;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (isSSR() || !this.isVisible) {
      return;
    }

    if ('src' in changes) {
      this.loadPDF();
    } else if (this._pdf) {
      if ('renderText' in changes || 'showAll' in changes) {
        this.setupViewer();
        this.resetPdfDocument();
      }
      if ('page' in changes) {
        const { page } = changes;
        if (page.currentValue === this._latestScrolledPage) {
          return;
        }

        // New form of page changing: The viewer will now jump to the specified page when it is changed.
        // This behavior is introduced by using the PDFSinglePageViewer
        this.pdfViewer.scrollPageIntoView({ pageNumber: this.page() });
      }

      this.update();
    }
  }

  public updateSize() {
    from(this._pdf!.getPage(this.pdfViewer.currentPageNumber))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page: PDFPageProxy) => {
          const rotation = this.rotation() + page.rotate;
          const viewportWidth =
            page.getViewport({
              scale: this.zoom(),
              rotation,
            }).width * CSS_UNITS;
          let scale = this.zoom();
          let stickToPage = true;

          // Scale the document when it shouldn't be in original size or doesn't fit into the viewport
          if (
            !this.originalSize() ||
            (this.fitToPage() &&
              viewportWidth >
                this.pdfViewerContainer().nativeElement.clientWidth)
          ) {
            const viewPort = page.getViewport({ scale: 1, rotation });
            scale = this.getScale(viewPort.width, viewPort.height);
            stickToPage = !this.stickToPage();
          }

          this.pdfViewer.currentScale = scale;
          if (stickToPage)
            this.pdfViewer.scrollPageIntoView({
              pageNumber: page.pageNumber,
              ignoreDestinationZoom: true,
            });
        },
      });
  }

  public clear() {
    if (this.loadingTask && !this.loadingTask.destroyed) {
      this.loadingTask.destroy();
    }

    if (this._pdf) {
      this._latestScrolledPage = 0;
      this._pdf.destroy();
      this._pdf = undefined;
    }

    this.pdfViewer && this.pdfViewer.setDocument(null as any);
    this.pdfLinkService && this.pdfLinkService.setDocument(null, null);
    this.pdfFindController && this.pdfFindController.setDocument(null as any);
  }

  private getPDFLinkServiceConfig() {
    const linkTarget = PdfViewerComponent.getLinkTarget(
      this.externalLinkTarget(),
    );

    if (linkTarget) {
      return { externalLinkTarget: linkTarget };
    }

    return {};
  }

  private initEventBus() {
    this.eventBus = createEventBus(PDFJSViewer, this.destroy$);

    fromEvent<CustomEvent>(this.eventBus, 'pagerendered')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.pageRendered.emit(event);
      });

    fromEvent<CustomEvent>(this.eventBus, 'pagesinit')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.pageInitialized.emit(event);
      });

    fromEvent(this.eventBus, 'pagechanging')
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ pageNumber }: any) => {
        if (this.pageScrollTimeout) {
          clearTimeout(this.pageScrollTimeout);
        }

        this.pageScrollTimeout = globalThis.setTimeout(() => {
          this._latestScrolledPage = pageNumber;
          this.pageChange.emit(pageNumber);
        }, 100);
      });

    fromEvent<CustomEvent>(this.eventBus, 'textlayerrendered')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.textLayerRendered.emit(event);
      });
  }

  private initPDFServices() {
    this.pdfLinkService = new PDFJSViewer.PDFLinkService({
      eventBus: this.eventBus,
      ...this.getPDFLinkServiceConfig(),
    });
    this.pdfFindController = new PDFJSViewer.PDFFindController({
      eventBus: this.eventBus,
      linkService: this.pdfLinkService,
    });
  }

  private getPDFOptions(): PDFViewerOptions {
    return {
      eventBus: this.eventBus,
      container: this.element.nativeElement.querySelector('div')!,
      removePageBorders: !this.showBorders(),
      linkService: this.pdfLinkService,
      textLayerMode: this.renderText()
        ? this.renderTextMode()
        : RenderTextMode.DISABLED,
      findController: this.pdfFindController,
      l10n: new PDFJSViewer.GenericL10n('en'),
      imageResourcesPath: this._imageResourcesPath,
      annotationEditorMode: PDFJS.AnnotationEditorType.DISABLE,
    };
  }

  private setupViewer() {
    if (this.pdfViewer) {
      this.pdfViewer.setDocument(null as any);
    }

    // assign(PDFJS, 'disableTextLayer', !this._renderText);

    this.initPDFServices();

    this.pdfViewer = this.showAll()
      ? new PDFJSViewer.PDFViewer(this.getPDFOptions())
      : new PDFJSViewer.PDFSinglePageViewer(this.getPDFOptions());
    this.pdfLinkService.setViewer(this.pdfViewer);

    this.pdfViewer._currentPageNumber = this.page();
  }

  private getValidPageNumber(page: number): number {
    if (page < 1) {
      return 1;
    }

    if (page > this._pdf!.numPages) {
      return this._pdf!.numPages;
    }

    return page;
  }

  private getDocumentParams() {
    const sourceType = typeof this.src();

    if (!this.cMapsUrl()) {
      return this.src();
    }

    const parameters: any = {
      cMapUrl: this.cMapsUrl(),
      cMapPacked: true,
      enableXfa: true,
    };
    parameters.isEvalSupported = false; // http://cve.org/CVERecord?id=CVE-2024-4367

    if (sourceType === 'string') {
      parameters.url = this.src();
    } else if (sourceType === 'object') {
      if ((this.src() as any).byteLength === undefined) {
        Object.assign(parameters, this.src());
      } else {
        parameters.data = this.src();
      }
    }

    return parameters;
  }

  private loadPDF() {
    if (!this.src) {
      return;
    }

    if (this.lastLoaded === this.src) {
      this.update();
      return;
    }

    this.clear();

    this.setupViewer();

    this.loadingTask = getDocument(this.getDocumentParams());

    this.loadingTask.onProgress = (progressData: PDFProgressData) => {
      this.onProgress.emit(progressData);
    };

    const source = this.src();

    from(this.loadingTask.promise)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pdf) => {
          this._pdf = pdf;
          this.lastLoaded = source;

          this.afterLoadComplete.emit(pdf);
          this.resetPdfDocument();

          this.update();
        },
        error: (error) => {
          this.lastLoaded = undefined;
          this.onError.emit(error);
        },
      });
  }

  private update() {
    this.render();
  }

  private render() {
    this.pageChange.emit(this.getValidPageNumber(this.page()));

    if (
      this.rotation() !== 0 ||
      this.pdfViewer.pagesRotation !== this.rotation()
    ) {
      // wait until at least the first page is available.
      this.pdfViewer.firstPagePromise?.then(
        () => (this.pdfViewer.pagesRotation = this.rotation()),
      );
    }

    if (this.stickToPage()) {
      setTimeout(() => {
        this.pdfViewer.currentPageNumber = this.page();
      });
    }

    if (this.pdfViewer._pages?.length) {
      this.updateSize();
    } else {
      // the first time we wait until pages init
      const sub = this.pageInitialized.subscribe(() => {
        this.updateSize();
        sub.unsubscribe();
      });
    }
  }

  private getScale(viewportWidth: number, viewportHeight: number) {
    const borderSize = this.showBorders() ? 2 * BORDER_WIDTH : 0;
    const pdfContainerWidth =
      this.pdfViewerContainer().nativeElement.clientWidth - borderSize;
    const pdfContainerHeight =
      this.pdfViewerContainer().nativeElement.clientHeight - borderSize;

    if (
      pdfContainerHeight === 0 ||
      viewportHeight === 0 ||
      pdfContainerWidth === 0 ||
      viewportWidth === 0
    ) {
      return 1;
    }

    let ratio = 1;
    switch (this.zoomScale()) {
      case 'page-fit': {
        ratio = Math.min(
          pdfContainerHeight / viewportHeight,
          pdfContainerWidth / viewportWidth,
        );
        break;
      }
      case 'page-height': {
        ratio = pdfContainerHeight / viewportHeight;
        break;
      }
      case 'page-width':
      default: {
        ratio = pdfContainerWidth / viewportWidth;
        break;
      }
    }

    return (this.zoom() * ratio) / CSS_UNITS;
  }

  private resetPdfDocument() {
    this.pdfLinkService.setDocument(this._pdf, null);
    this.pdfFindController.setDocument(this._pdf!);
    this.pdfViewer.setDocument(this._pdf!);
  }

  private initialize(): void {
    if (isSSR() || !this.isVisible) {
      return;
    }

    this.isInitialized = true;
    this.initEventBus();
    this.setupViewer();
  }

  private setupResizeListener(): void {
    if (isSSR()) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      fromEvent(globalThis, 'resize')
        .pipe(
          debounceTime(100),
          filter(() => this.autoresize() && !!this._pdf),
          takeUntil(this.destroy$),
        )
        .subscribe(() => {
          this.updateSize();
        });
    });
  }
}
