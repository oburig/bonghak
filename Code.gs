// Google Apps Script (Code.gs)
// 이 코드를 복사하여 Google Apps Script 편집기에 붙여넣으세요.

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memberSheet = ss.getSheetByName('Members') || ss.insertSheet('Members');
  const matchSheet = ss.getSheetByName('Matches') || ss.insertSheet('Matches');
  
  // 시트 헤더가 없으면 생성
  if (memberSheet.getLastRow() === 0) {
    memberSheet.appendRow(['id', 'name', 'phone', 'position', 'photo', 'clubRole']);
  }
  if (matchSheet.getLastRow() === 0) {
    matchSheet.appendRow(['id', 'date', 'teamA', 'teamB', 'scoreA', 'scoreB', 'records', 'photo', 'category', 'venue', 'memo']);
  }

  const members = getRowsData(memberSheet);
  const matches = getRowsData(matchSheet);
  
  return ContentService.createTextOutput(JSON.stringify({ members, matches }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.type);
  
  if (!sheet) return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
  
  let rowData = data.row;
  const id = data.id;
  
  // 사진 데이터 처리 (Google Drive 저장)
  // 매치 사진 처리 (row[7])
  if (data.type === 'Matches' && rowData[7] && String(rowData[7]).startsWith('data:image')) {
    rowData[7] = saveImageToDrive(rowData[7], 'match_' + id);
  } 
  // 회원 사진 처리 (row[4])
  else if (data.type === 'Members' && rowData[4] && String(rowData[4]).startsWith('data:image')) {
    rowData[4] = saveImageToDrive(rowData[4], 'member_' + id);
  }

  const sheetData = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  // ID로 기존 행 찾기
  for (let i = 1; i < sheetData.length; i++) {
    if (sheetData[i][0].toString() === id.toString()) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex > 0) {
    // 수정 (Update)
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // 추가 (Add)
    sheet.appendRow(rowData);
  }
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

function saveImageToDrive(base64Data, fileName) {
  try {
    if (!base64Data || typeof base64Data !== 'string' || !base64Data.includes(',')) {
      return base64Data;
    }
    
    const splitData = base64Data.split(',');
    if (splitData.length < 2) return base64Data;
    
    const header = splitData[0];
    const content = splitData[1];
    
    // Extract mime type
    const mimeMatch = header.match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    const folderName = "BongHak_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    const bytes = Utilities.base64Decode(content);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Direct link for <img> tags
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (e) {
    return base64Data; // 실패 시 base64 그대로 반환 (시트 용량 초과 주의)
  }
}

function getRowsData(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}
