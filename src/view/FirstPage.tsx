import "./FirstPage.css";
import { Viewer, Entity, ImageryLayer } from "resium";
import {
    Cartesian3,
    Color,
    Ion,
    createWorldTerrainAsync,
    createOsmBuildingsAsync,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useState } from "react";

function FirstPage() {
    // 设置 Cesium ion access token (你需要注册一个免费的 token)
    Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0MmM0OTcxYS01ZTNhLTQwNGEtOWI5My01OTQxMWUxYzkzYmUiLCJpZCI6MjY1NTczLCJpYXQiOjE3MzU0ODQ4MzN9.AsJ-Pj5zQi0s1FGGL7cu0K-U7PcIk45WmdbA9qX7cXc";

    // 北京四环附近的坐标 (望京区域)
    const BEIJING_POSITION = {
        longitude: 116.47,
        latitude: 39.99,
        height: 500,
    };

    const [terrainProvider, setTerrainProvider] = useState<any>(null);
    const [osmBuildings, setOsmBuildings] = useState<any>(null);

    useEffect(() => {
        // 异步加载地形数据
        createWorldTerrainAsync().then(terrain => {
            setTerrainProvider(terrain);
        });

        // 异步加载建筑数据
        createOsmBuildingsAsync().then(buildings => {
            setOsmBuildings(buildings);
        });
    }, []);

    return (
        <div className="container">
            <header>
                <h1>飞行器可视化仿真软件</h1>
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
                    <Viewer
                        terrainProvider={terrainProvider}
                        scene3DOnly={true}
                        baseLayerPicker={false}
                        navigationHelpButton={false}
                        homeButton={false}
                        geocoder={false}
                        sceneModePicker={false}
                        fullscreenButton={false}
                        timeline={false}
                        animation={false}
                        view={{
                            destination: Cartesian3.fromDegrees(
                                BEIJING_POSITION.longitude,
                                BEIJING_POSITION.latitude,
                                BEIJING_POSITION.height
                            ),
                            orientation: {
                                heading: 0.0,
                                pitch: -0.5,
                                roll: 0.0,
                            },
                        }}
                    >
                        {osmBuildings && (
                            <ImageryLayer imageryProvider={osmBuildings} />
                        )}

                        <Entity
                            position={Cartesian3.fromDegrees(
                                BEIJING_POSITION.longitude,
                                BEIJING_POSITION.latitude,
                                0
                            )}
                            point={{
                                pixelSize: 10,
                                color: Color.RED,
                            }}
                            description="这是北京四环望京区域的一个点"
                        />
                    </Viewer>
                </main>
            </div>
        </div>
    );
}

export default FirstPage;
