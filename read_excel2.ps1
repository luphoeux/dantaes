$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$filePath = 'd:\Repositorios\2026\Febrero\Dantaes - Libro de ventas\GUIA PARA FARMEAR ORO EN MIDNIGHT DANTAES V0.1.xlsx'
$wb = $excel.Workbooks.Open($filePath)

Write-Host "=== HOJAS DEL ARCHIVO ($($wb.Sheets.Count) hojas) ==="
$sheetNum = 0
foreach ($sheet in $wb.Sheets) {
    $sheetNum++
    $usedRange = $sheet.UsedRange
    $rows = $usedRange.Rows.Count
    $cols = $usedRange.Columns.Count
    Write-Host ""
    Write-Host "[$sheetNum] $($sheet.Name) | Filas: $rows | Columnas: $cols"
    Write-Host "--- Primeras 20 filas no vacías ---"
    $count = 0
    for ($r = 1; $r -le $rows -and $count -lt 20; $r++) {
        $rowData = @()
        for ($c = 1; $c -le [Math]::Min($cols, 8); $c++) {
            $val = $usedRange.Cells.Item($r, $c).Text
            if ($val.Trim() -ne "") {
                $rowData += "[$c]: $val"
            }
        }
        if ($rowData.Count -gt 0) {
            Write-Host "  Fila $r => $($rowData -join ' | ')"
            $count++
        }
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Host ""
Write-Host "=== LISTO ==="
