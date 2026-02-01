# PDF Quotation Feature - Implementation Summary

## Overview
A high-fidelity, multi-page PDF generation feature has been implemented for the "Expediente Técnico" (Formal Quotation). 
This upgrades the previous single-page view to a comprehensive document structure suitable for corporate presentation (10-20+ pages).

## Structure
The PDF is generated using `html2canvas` and `jspdf` by iterating over a distinct set of visual "Page" elements hidden in the DOM.

### 1. Page Definition
The container `#pdf-container` (hidden) holds multiple `.pdf-page` elements. Each `.pdf-page` is sized to a fixed 800px width (mapping to A4 width at high DPI) and min-height logic to ensure consistent paging.

### 2. Page Types
- **Cover Page**:
  - **Header**: Corporate Logo (Large, h-80), Title "Expediente Propuesta Económica", Folio, Date.
  - **Project Card**: Dark mode card with glassmorphism blur, displaying Coverage (Sites), Logistics (Routes), and Duration.
  - **Financial Summary**: High-level table of Operating Costs, Viaticos, Margin, and Total Investment.
  - **Footer**: Validity terms and page number.

- **Route Detail Pages** (Dynamic Loop):
  - Iterates through `optimizedRoutes`.
  - **Capacity**: 2 Routes per A4 page to balance readability and density.
  - **Content**:
    - **Route Header**: Driver Name, Store Count, Direction, Total KM.
    - **Stops Table**: Sequence No., Store Name, Location/City, Site ID.
    - **Styling**: Blue branding for headers, alternate row shading.

- **Signature Page** (Final):
  - **Authorization Section**: Formal acceptance text.
  - **Signature Blocks**: Space for "Gerencia de Operaciones" and "Cliente Autorizado".
  - **Footer**: Watermark and platform credit.

## Tech Stack
- **Library**: `html2canvas` (Capture) + `jspdf` (Assembly).
- **Styles**: Tailwind CSS for pixel-perfect design.
- **Orientation**: Portrait A4.

## Key Methods
- `handleExportQuotationPDF`: 
  1. Selects all `.pdf-page` elements.
  2. Temporarily positions them absolute/top-0 for clean capture.
  3. Captures each as PNG.
  4. Adds to PDF (looping `pdf.addPage()`).
  5. Saves as `Expediente_Tecnico_Target_[ProjectName].pdf`.

## Branding
- **Colors**:
  - Primary Blue: `#003399`
  - Accent Red: `#CC0000`
  - Slate scales for text/backgrounds.
- **Logos**:
  - Cover: Large prominent placement.
  - Headers: Subtle branding.
  - Background: Watermark opacity.
