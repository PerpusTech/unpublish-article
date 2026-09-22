import ExcelJS from 'exceljs';

export interface ExcelColumnDefinition {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
}

export interface ExcelExportOptions {
  title?: string;
  sheetName?: string;
  columns: ExcelColumnDefinition[];
  rows: Record<string, any>[];
  headerBgColor?: string; // hex ARGB, default 'FF1E293B' (slate-800)
}

/**
 * Builds a professionally formatted Excel buffer (.xlsx)
 * Complete with borders on every cell, styled headers, auto-calculated widths, and gridlines.
 */
export async function generateStyledExcelBuffer(options: ExcelExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UPT Perpustakaan UMS';
  workbook.lastModifiedBy = 'EPrints Unpublish System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = options.sheetName || 'Data';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  const headerBg = options.headerBgColor || 'FF1E293B';

  // Set worksheet columns
  worksheet.columns = options.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 4, 12),
  }));

  // Style Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = {
    name: 'Arial',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: headerBg },
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: false,
  };

  // Border definition
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // Add Data Rows
  options.rows.forEach((rowData) => {
    const row = worksheet.addRow(rowData);
    row.height = 22;
  });

  // Apply cell styling, borders, and column alignments
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;

      if (rowNumber === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerBg },
        };
      } else {
        const colDef = options.columns[colNumber - 1];
        const align = colDef?.align || 'left';

        cell.font = {
          name: 'Arial',
          size: 9.5,
          color: { argb: 'FF1E293B' },
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: align,
        };

        if (colDef?.numFmt) {
          cell.numFmt = colDef.numFmt;
        }

        // Slight alternating row shading
        if (rowNumber % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      }
    });
  });

  // Auto-adjust column width to content if not strictly specified
  options.columns.forEach((colDef, idx) => {
    if (!colDef.width) {
      let maxLen = colDef.header.length;
      options.rows.forEach((r) => {
        const val = r[colDef.key];
        if (val !== undefined && val !== null) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      });
      worksheet.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 4, 12), 45);
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
