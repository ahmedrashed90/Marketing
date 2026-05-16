/**
 * Google Apps Script Web App لرفع ملفات تاسكات الأقسام على Google Drive.
 * Deploy > New deployment > Web app
 * Execute as: Me
 * Who has access: Anyone / Anyone with the link حسب احتياجك
 * بعد النشر انسخ Web App URL، وأول مرة تضغط إرفاق المهام في السيستم هيسألك عليه ويحفظه في المتصفح.
 */
const ROOT_FOLDER_ID = ''; // اختياري: ضع ID فولدر رئيسي، أو اتركه فارغًا ليحفظ في My Drive

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action !== 'uploadTaskFile') throw new Error('Unknown action');

    const root = ROOT_FOLDER_ID ? DriveApp.getFolderById(ROOT_FOLDER_ID) : DriveApp.getRootFolder();
    const deptName = cleanName(data.departmentName || 'قسم غير محدد');
    const campaignName = cleanName(data.campaignName || data.taskId || 'تاسك');
    const taskFolder = getOrCreateFolder(root, campaignName);
    const deptFolder = getOrCreateFolder(taskFolder, deptName);

    const bytes = Utilities.base64Decode(data.fileBase64 || '');
    const blob = Utilities.newBlob(bytes, data.mimeType || 'application/octet-stream', data.fileName || 'file');
    const file = deptFolder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonOutput({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      webViewLink: file.getUrl(),
      departmentName: data.departmentName || '',
      taskId: data.taskId || '',
      uploadedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function cleanName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'بدون اسم';
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
