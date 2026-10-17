$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$book = Get-ChildItem -LiteralPath $root -Filter '*R2.xlsx' | Select-Object -First 1
$zip = [IO.Compression.ZipFile]::OpenRead($book.FullName)
function Read-BookXml($path) {
  $reader = [IO.StreamReader]::new($zip.GetEntry($path).Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  $strings = Read-BookXml 'xl/sharedStrings.xml'
  $ss = @($strings.sst.si | ForEach-Object { $_.InnerText })
  $wb = Read-BookXml 'xl/workbook.xml'
  $rels = Read-BookXml 'xl/_rels/workbook.xml.rels'
  $sheets = @()
  foreach ($sheet in $wb.workbook.sheets.sheet) {
    $id = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $rel = $rels.Relationships.Relationship | Where-Object Id -eq $id
    $xml = Read-BookXml ('xl/' + $rel.Target)
    $cells = @()
    foreach ($c in $xml.SelectNodes('//*[local-name()="sheetData"]/*/*[local-name()="c"]')) {
      $v = $c.SelectSingleNode('*[local-name()="v"]')
      $f = $c.SelectSingleNode('*[local-name()="f"]')
      if ($null -eq $v -and $null -eq $f) { continue }
      $value = if ($v) { $v.InnerText } else { '' }
      if ($c.t -eq 's') { $value = $ss[[int]$value] }
      $cells += @{ cell = $c.r; value = $value; formula = $(if ($f) { $f.InnerText } else { '' }); formulaXml = $(if ($f) { $f.OuterXml } else { '' }) }
    }
    $sheets += @{ name = $sheet.name; cells = $cells }
  }
  $destination = Join-Path $root 'docs/research/stress-release/workbook.json'
  $sheets | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 -LiteralPath $destination
  Write-Output "Extracted $($sheets.Count) worksheets."
} finally { $zip.Dispose() }
