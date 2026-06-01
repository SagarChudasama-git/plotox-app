class DataParser {
  /**
   * Parse CSV/TSV text and automatically infer column types and calculate summary statistics.
   * @param {string} text - The raw CSV/TSV content.
   * @returns {Object} - Parsed dataset object containing headers, rows, types, and stats.
   */
  static parse(text, customDelimiter = null) {
    if (!text || text.trim() === '') {
      throw new Error("The file is empty.");
    }

    // Strip BOM characters (common in Excel-exported CSV)
    text = text.replace(/^\uFEFF/, '');

    // 1. Detect Delimiter (Commas, Tabs, Semicolons, Pipes)
    let delimiter = ',';
    if (customDelimiter) {
      delimiter = customDelimiter;
    } else {
      const lines = text.split(/\r?\n/);
      const firstLine = lines[0] || '';
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const pipeCount = (firstLine.match(/\|/g) || []).length;

      const counts = [
        { char: ',', count: commaCount },
        { char: '\t', count: tabCount },
        { char: ';', count: semicolonCount },
        { char: '|', count: pipeCount }
      ];

      counts.sort((a, b) => b.count - a.count);
      if (counts[0].count > 0) {
        delimiter = counts[0].char;
      }
    }

    // 2. Parse CSV/TSV text into 2D Array (supporting quotes and line breaks within quotes)
    const rows = [];
    let currentCell = '';
    let inQuotes = false;
    let currentRow = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Double double-quotes inside quotes acts as an escaped quote
          currentCell += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip the trailing \n for \r\n line endings
        }
        currentRow.push(currentCell.trim());

        // Only push row if it contains data
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    // Push final cells if file doesn't end with a newline
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }

    if (rows.length === 0) {
      throw new Error("No readable rows found in the dataset.");
    }

    // 3. Extract Headers and Data Rows
    const headers = rows[0]
      .map(h => h.replace(/^"(.*)"$/, '$1').trim())
      .filter(h => h !== '');

    if (headers.length === 0) {
      throw new Error("No column headers could be parsed from the first row.");
    }

    // Filter out rows that do not match header length to ensure data integrity
    const expectedLength = headers.length;
    const dataRows = [];
    const invalidRows = [];

    for (let idx = 1; idx < rows.length; idx++) {
      const r = rows[idx];
      // Skip empty or all-whitespace lines
      if (r.length === 1 && r[0].trim() === '') continue;
      if (r.every(cell => cell.trim() === '')) continue;

      if (r.length === expectedLength) {
        dataRows.push(r);
      } else {
        invalidRows.push({ rowIndex: idx, rowData: r });
      }
    }

    if (dataRows.length === 0) {
      throw new Error("No data rows matched the column count of the header row.");
    }

    // 4. Type Inference & Statistics Calculation
    const types = {};
    const stats = {};

    headers.forEach((colName, colIdx) => {
      let numericCount = 0;
      let dateCount = 0;
      let filledCount = 0;
      let emptyCount = 0;
      const values = [];

      dataRows.forEach(row => {
        let val = row[colIdx];
        if (val === undefined || val === null || val === '') {
          emptyCount++;
          return;
        }

        filledCount++;
        values.push(val);

        // Standardize clean string for numeric testing (remove $, %, commas)
        const cleanNumStr = val.replace(/[\$,%]/g, '').trim();
        if (cleanNumStr !== '' && !isNaN(Number(cleanNumStr))) {
          numericCount++;
        }

        // Test Date format (exclude simple small integers/years below 1000)
        const dateVal = Date.parse(val);
        const isYearOnly = /^\d{4}$/.test(val);
        if (!isNaN(dateVal) && !isYearOnly && val.length >= 4) {
          dateCount++;
        }
      });

      // Type assignment:
      if (filledCount === 0) {
        types[colName] = 'categorical'; // Default fallback for empty cols
      } else if (numericCount === filledCount) {
        types[colName] = 'numeric';
      } else if (dateCount === filledCount) {
        types[colName] = 'datetime';
      } else {
        types[colName] = 'categorical';
      }

      // Calculations of Statistics
      if (types[colName] === 'numeric') {
        const numbers = values.map(val => Number(val.replace(/[\$,%]/g, '').trim()));
        const sum = numbers.reduce((a, b) => a + b, 0);
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const mean = sum / numbers.length;

        stats[colName] = {
          min: parseFloat(min.toFixed(4)),
          max: parseFloat(max.toFixed(4)),
          mean: parseFloat(mean.toFixed(4)),
          sum: parseFloat(sum.toFixed(4)),
          count: filledCount,
          missing: emptyCount
        };
      } else {
        // Categorical / Datetime Statistics
        const freqMap = {};
        values.forEach(v => {
          freqMap[v] = (freqMap[v] || 0) + 1;
        });

        const uniqueCount = Object.keys(freqMap).length;
        let topVal = '';
        let topFreq = 0;
        for (const v in freqMap) {
          if (freqMap[v] > topFreq) {
            topVal = v;
            topFreq = freqMap[v];
          }
        }

        stats[colName] = {
          unique: uniqueCount,
          top: topVal,
          topFreq: topFreq,
          count: filledCount,
          missing: emptyCount
        };
      }
    });

    return {
      headers,
      columns: headers,
      types,
      stats,
      rows: dataRows,
      delimiter,
      invalidRowCount: invalidRows.length
    };
  }
}

// Make globally available
window.DataParser = DataParser;
