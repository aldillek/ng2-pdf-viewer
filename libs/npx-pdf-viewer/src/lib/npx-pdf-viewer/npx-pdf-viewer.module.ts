/**
 * Created by vadimdez on 01/11/2016.
 */
import { NgModule } from '@angular/core';

import { NpxPdfViewerComponent } from './npx-pdf-viewer.component';

export * from '../utils/typings';

@NgModule({
  declarations: [NpxPdfViewerComponent],
  exports: [NpxPdfViewerComponent],
})
export class NpxPdfViewerModule {}
