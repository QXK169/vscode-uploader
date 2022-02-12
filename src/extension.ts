import * as vscode from "vscode";
const fs = require("fs");
const tinify = require("tinify");
const imageConfig = vscode.workspace.getConfiguration("upload_image");
const OSS = require("ali-oss");
const stream = require("stream");

let client = new OSS({
  // yourRegion填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
  region: imageConfig.region,
  // 阿里云账号AccessKey拥有所有API的访问权限，风险很高。强烈建议您创建并使用RAM用户进行API访问或日常运维，请登录RAM控制台创建RAM用户。
  accessKeyId: imageConfig.accessKey,
  accessKeySecret: imageConfig.secretKey,
  // 填写Bucket名称，例如examplebucket。
  bucket: imageConfig.bucket,
});
// 处理图片名
function handleImageName(tempFilePath: string): string {
  const filepath = tempFilePath;
  const index = filepath.lastIndexOf(".");
  const filename = filepath.substr(index + 1);
  return `static/mini/wxapp_${new Date().getTime()}_${Math.random()
    .toString(36)
    .substr(3)}.${filename}`;
}

function compressBuffer(
  sourceData: any,
  key =  imageConfig.tinyKey
) {
  return new Promise((resolve, reject) => {
    tinify.key = key;
    tinify
      .fromBuffer(sourceData)
      .toBuffer(function (err: any, resultData: any) {
        if (resultData) {
          resolve(resultData);
        }
        if (err) {
          reject(err);
        }
      });
  });
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let texteditor = vscode.commands.registerTextEditorCommand(
    "choosedImage",
    async () => {
      const uri =
        (await vscode.window.showOpenDialog({
          title: "上传图片",
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            images: ["png", "jpg", "apng", "jpeg", "gif", "webp"],
          },
        })) || [];
      if (uri.length) {
        const tempFilePath = uri[0].path.slice(1);
        const index = tempFilePath.lastIndexOf(".");
        const filename = tempFilePath.substr(index + 1);
        let uplaod = `Uploads/wxapp_${new Date().getTime()}_${Math.random()
          .toString(36)
          .substr(3)}.${filename}`;
        fs.readFile(tempFilePath, async (err: any, data: any) => {
          if (err) {
            console.log(err);
            throw err;
          } else {
            //   上传oss
            compressBuffer(data)
              .then(async (res) => {
                // console.log(res);
                // 创建一个bufferstream
                const bufferStream = new stream.PassThrough();
                //将Buffer写入
                bufferStream.end(res);
                //进一步使用
                bufferStream.pipe(process.stdout);
                try {                  
                  const result = await client.putStream(uplaod, bufferStream);
                  const url = imageConfig.baseUrl + result.name;
                  addImageUrlToEditor(url);
                } catch (error) {
                  console.log(err);
                }
              })
              .catch((err) => {
                console.log(err, "压缩失败");
              });
          }
        });
      }
    }
  );
  context.subscriptions.push(texteditor);
}

// 图片地址插入编辑器中
function addImageUrlToEditor(url: string) {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const { start, end, active } = editor.selection;
  if (start.line === end.line && start.character === end.character) {
    // 在光标位置插入内容
    const activePosition = active;
    editor.edit((editBuilder) => {
      editBuilder.insert(activePosition, url);
    });
  } else {
    // 替换内容
    const selection = editor.selection;
    editor.edit((editBuilder) => {
      editBuilder.replace(selection, url);
    });
  }
}
// this method is called when your extension is deactivated
export function deactivate() {}
