/**
 * 구글 앱스 스크립트 (GAS) - 최종 수정본
 * 
 * 기능: 
 * 1. 데이터를 시트에 저장할 때 사진(Base64)을 구글 드라이브에 파일로 저장.
 * 2. 시트(H열)에는 저장된 사진의 구글 드라이브 링크 주소를 기록.
 * 3. 데이터 조회 시 시트의 내용을 JSON으로 반환.
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memberSheet = ss.getSheetByName('Members');
  const matchSheet = ss.getSheetByName('Matches');
  
  // 시트가 없으면 기본 헤더와 함께 생성 (CamelCase 유지)
  if (!memberSheet) {
    const s = ss.insertSheet('Members');
    s.appendRow(['id', 'name', 'phone', 'position', 'photo', 'clubRole']);
  }
  if (!matchSheet) {
    const s = ss.insertSheet('Matches');
    s.appendRow(['id', 'date', 'teamA', 'teamB', 'scoreA', 'scoreB', 'records', 'photo', 'category', 'venue', 'memo']);
  }
  
  const members = getRowsData(ss.getSheetByName('Members'));
  const matches = getRowsData(ss.getSheetByName('Matches'));
  
  const result = {
    members: members,
    matches: matches
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(data.type);
    
    if (!sheet) throw new Error("시트를 찾을 수 없습니다: " + data.type);
    
    let rowData = data.row;
    const action = data.action;
    const id = data.id;

    // 사진 처리 로직 (H열 또는 E열)
    if (data.type === 'Matches' && rowData[7] && rowData[7].toString().indexOf('data:image') === 0) {
      rowData[7] = saveImageToDrive(rowData[7], "Match_" + id);
    }
    if (data.type === 'Members' && rowData[4] && rowData[4].toString().indexOf('data:image') === 0) {
      rowData[4] = saveImageToDrive(rowData[4], "Member_" + id);
    }

    const sheetData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] == id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (action === 'add' || (action === 'update' && rowIndex === -1)) {
      sheet.appendRow(rowData);
    } else if (action === 'update' && rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else if (action === 'delete' && rowIndex !== -1) {
      sheet.deleteRow(rowIndex);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: id }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function saveImageToDrive(base64Data, fileName) {
  try {
    const splitData = base64Data.split(',');
    const contentType = splitData[0].match(/:(.*?);/)[1];
    const byteData = Utilities.base64Decode(splitData[1]);
    const blob = Utilities.newBlob(byteData, contentType, fileName);
    
    const folderName = "BongHak_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    return "https://drive.google.com/uc?export=view&id=" + fileId;
  } catch (e) {
    return base64Data;
  }
}

function getRowsData(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      // 헤더 이름을 그대로 사용 (소문자 변환 제거)
      let key = headers[j].toString().trim();
      
      // 혹시 시트 헤더가 소문자일 경우를 대비한 수동 매핑 (안전장치)
      if (key.toLowerCase() === 'teama') key = 'teamA';
      if (key.toLowerCase() === 'teamb') key = 'teamB';
      if (key.toLowerCase() === 'scorea') key = 'scoreA';
      if (key.toLowerCase() === 'scoreb') key = 'scoreB';
      if (key.toLowerCase() === 'clubrole') key = 'clubRole';
      
      let value = data[i][j];
      
      if (typeof value === 'string' && (value.indexOf('[') === 0 || value.indexOf('{') === 0)) {
        try {
          value = JSON.parse(value);
        } catch (e) {}
      }
      row[key] = value;
    }
    rows.push(row);
  }
  return rows;
}
