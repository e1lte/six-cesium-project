import React, { useState } from "react";
import "./FirstPage.css";

function FirstPage() {
    return (
        <div className="container">
            <header>
                <h1>Six-Cesium-Project</h1>
            </header>
            <div className="content">
                <nav>
                    <div className="nav-div">
                        <a href="#">仿真显示</a>
                    </div>
                    <div className="nav-div">
                        <a href="#">指令调用</a>
                    </div>
                    <div className="nav-div">
                        <a href="#">数据记录</a>
                    </div>
                    <div className="nav-div">
                        <a href="#">实时上传</a>
                    </div>
                </nav>
                <main>
                    <div
                        style={{
                            height: "500px",
                            width: "100px",
                            backgroundColor: "#f0f0f0",
                        }}
                    ></div>

                    <div
                        style={{
                            height: "200px",
                            width: "400px",
                        }}
                        className="test-div"
                    >
                        特效
                    </div>
                    {/* <div style={{ height: "2000px" }}></div> */}
                </main>
            </div>
        </div>
    );
}

export default FirstPage;
