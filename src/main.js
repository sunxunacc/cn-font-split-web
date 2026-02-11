import "./style.css";

// 显示输出
function log(message) {
  const output = document.getElementById("output");
  output.innerHTML += `<p>${message}</p>`;
  console.log(message);
}

// 下载文件函数
function downloadFile(name, data) {
  try {
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log(`文件下载成功: ${name}`);
  } catch (error) {
    log(`文件下载失败: ${name}, 错误: ${error.message}`);
    console.error(`文件下载失败: ${name}`, error);
  }
}

document.querySelector("#app").innerHTML = `
  <div>
    <h1>cn-font-split-web</h1>
    <div class="controls">
      <input type="file" id="fontFile" accept=".ttf,.otf,.woff,.woff2" />
      <button id="startBtn">开始分割</button>
    </div>
    <div id="output"></div>
  </div>
`;

// 全局变量存储上传的字体文件
let uploadedFontFile = null;

// 绑定文件上传事件
document.getElementById("fontFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    uploadedFontFile = file;
    log(`已选择字体文件: ${file.name}，大小: ${file.size} 字节`);
  } else {
    uploadedFontFile = null;
    log("请选择一个字体文件");
  }
});

// 绑定开始按钮事件
document.getElementById("startBtn").addEventListener("click", function () {
  if (!uploadedFontFile) {
    log("请先选择一个字体文件");
    return;
  }
  splitFont();
});

// 主函数
async function splitFont() {
  try {
    log("开始初始化...");

    // 按照实际文件结构导入
    log("导入cn-font-split模块...");
    const { fontSplit, StaticWasm } =
      await import("cn-font-split/dist/wasm/index.mjs");

    // 尝试获取WASM文件
    log("加载WASM文件...");
    let wasmBuffer;
    try {
      const wasmResponse = await fetch("libffi-wasm32-wasip1.wasm");
      if (!wasmResponse.ok) {
        throw new Error(`WASM文件下载失败: ${wasmResponse.status}`);
      }
      wasmBuffer = await wasmResponse.arrayBuffer();
      log(`WASM文件加载成功，大小: ${wasmBuffer.byteLength} 字节`);
    } catch (error) {
      log(`WASM文件加载失败: ${error.message}`);
      console.error("WASM文件加载失败:", error);
      throw error;
    }

    // 读取上传的字体文件
    log("读取上传的字体文件...");
    let input;
    try {
      const reader = new FileReader();
      input = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(uploadedFontFile);
      });
      log(`字体文件读取完成，大小: ${input.byteLength} 字节`);
    } catch (error) {
      log(`字体文件加载失败: ${error.message}`);
      console.error("字体文件加载失败:", error);
      throw error;
    }

    // 只需要初始化一次
    log("初始化WASM...");
    let wasm;
    try {
      // 修复：StaticWasm构造函数期望传入的是URL字符串或有buffer属性的对象
      // 我们传入的是ArrayBuffer，所以需要包装一下
      const wasmBufferWrapper = {
        buffer: wasmBuffer,
      };
      wasm = new StaticWasm(wasmBufferWrapper);
      log("WASM初始化完成");
      log(`Wasm对象: ${wasm}`);
      log(`WasiHandle: ${wasm.WasiHandle}`);
    } catch (error) {
      log(`WASM初始化失败: ${error.message}`);
      console.error("WASM初始化失败:", error);
      throw error;
    }

    log("开始分割字体...");

    try {
      const data = await fontSplit(
        {
          input: new Uint8Array(input),
          outDir: "./dist",
          css: {
            fontFamily: "HYHuaMuLanJ",
          },
          // chunkSize: 10 * 1024 * 1024, // 每个分包约 3MB
          // chunkSizeTolerance: 500 * 1024, // 容差 500KB
          // maxAllowSubsetsCount: 5, // 最多 5 个分包
          reduceMins: true, // 减少碎片分包，合并小分包
          testHtml: true, // 生成测试 HTML 文件
          reporter: true, // 生成 reporter.bin 文件
        },
        wasm.WasiHandle,
        {
          logger(str, type) {
            console.log(str);
            log(str);
          },
        },
      );

      log("字体分割完成！");
      log(`分割结果：${JSON.stringify(data, null, 2)}`);
      console.log(data);

      // 下载分割后的文件
      log("开始下载分割后的文件...");
      if (Array.isArray(data)) {
        log(`共生成 ${data.length} 个文件`);
        data.forEach((file, index) => {
          if (file.name && file.data) {
            log(`下载第 ${index + 1} 个文件: ${file.name}`);
            downloadFile(file.name, file.data);
          }
        });
        log("所有文件下载完成！");
      } else {
        log("分割结果格式不正确，无法下载文件");
      }
    } catch (error) {
      log(`字体分割失败: ${error.message}`);
      console.error("字体分割失败:", error);
      throw error;
    }
  } catch (error) {
    log(`错误：${error.message}`);
    console.error(error);
  }
}
