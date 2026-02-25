$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$filePath = 'd:\Repositorios\2026\Febrero\Dantaes - Libro de ventas\GUIA PARA FARMEAR ORO EN MIDNIGHT DANTAES V0.1.xlsx'
$wb = $excel.Workbooks.Open($filePath)
Write-Host "Total Sheets: $($wb.Sheets.Count)"
foreach ($sheet in $wb.Sheets) {
    Write-Host ""
    Write-Host "=== Sheet: $($sheet.Name) ==="
    $usedRange = $sheet.UsedRange
    $rows = $usedRange.Rows.Count
    $cols = $usedRange.Columns.Count
    Write-Host "Rows: $rows | Cols: $cols"
    $maxRows = [Math]::Min($rows, 50)
    $maxCols = [Math]::Min($cols, 15)
    for ($r = 1; $r -le $maxRows; $r++) {
        $rowData = @()
        for ($c = 1; $c -le $maxCols; $c++) {
            $cell = $usedRange.Cells.Item($r, $c)
            $rowData += $cell.Text
        }
        $line = $rowData -join " | "
        if ($line.Trim() -ne "") {
            Write-Host $line
        }
    }
    if ($rows -gt 50) {
        Write-Host "... ($($rows - 50) more rows)"
    }
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Host "Done."
