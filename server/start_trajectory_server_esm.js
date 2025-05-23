#!/usr/bin/env node

/**
 * 轨迹仿真服务器启动脚本 (ES模块版本)
 *
 * 使用方法:
 * node server/start_trajectory_server_esm.js
 * 或者
 * npm run server:trajectory
 */

console.log("🚀 正在启动轨迹仿真服务器...");
console.log("");

// 检查Node.js版本
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

if (majorVersion < 14) {
    console.error("❌ 错误: 需要Node.js 14.0.0或更高版本");
    console.error(`   当前版本: ${nodeVersion}`);
    process.exit(1);
}

// 检查ws模块是否安装
try {
    await import("ws");
    console.log("✅ WebSocket模块检查通过");
} catch (error) {
    console.error("❌ 错误: 缺少ws模块");
    console.error("   请运行: npm install ws");
    process.exit(1);
}

console.log("✅ 环境检查通过");
console.log("");

// 启动服务器
try {
    await import("./trajectory_server_esm.js");
} catch (error) {
    console.error("❌ 启动服务器失败:", error.message);
    process.exit(1);
}
