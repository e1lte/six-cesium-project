import React, { useState } from "react";
import "./FirstPage.css";

const SimulationConfigModal = ({ onClose, onConfirm }) => {
    const [configs, setConfigs] = useState([
        {
            id: 1,
            targetModel: null,
            missileModel: null,
            trajectory: null,
            targetModelFile: null,
            missileModelFile: null,
            trajectoryFile: null,
        },
    ]);

    const addConfig = () => {
        setConfigs([
            ...configs,
            {
                id: Date.now(),
                targetModel: null,
                missileModel: null,
                trajectory: null,
                targetModelFile: null,
                missileModelFile: null,
                trajectoryFile: null,
            },
        ]);
    };

    const removeConfig = id => {
        if (configs.length <= 1) return;
        setConfigs(configs.filter(config => config.id !== id));
    };

    const handleFileChange = (id, type, event) => {
        const file = event.target.files[0];
        if (!file) return;

        setConfigs(
            configs.map(config => {
                if (config.id === id) {
                    return {
                        ...config,
                        [type]: URL.createObjectURL(file),
                        [`${type}File`]: file,
                    };
                }
                return config;
            })
        );
    };

    const handleConfirm = () => {
        console.log("sss", configs);
        onConfirm(configs);
        onClose();
    };

    return (
        <div className="config-modal-overlay">
            <div className="config-modal">
                <h2>仿真配置</h2>
                <button className="close-btn" onClick={onClose}>
                    ×
                </button>

                <div className="config-list">
                    {configs.map(config => (
                        <div key={config.id} className="config-item">
                            <div className="model-inputs">
                                <div className="model-input">
                                    <label>目标模型</label>
                                    <input
                                        type="file"
                                        accept=".glb,.gltf"
                                        onChange={e =>
                                            handleFileChange(
                                                config.id,
                                                "targetModel",
                                                e
                                            )
                                        }
                                        style={{ display: "none" }}
                                        id={`target-model-${config.id}`}
                                    />
                                    <label
                                        htmlFor={`target-model-${config.id}`}
                                        className="file-input-label"
                                    >
                                        {config.targetModelFile
                                            ? config.targetModelFile.name
                                            : "选择文件"}
                                    </label>
                                </div>
                                <div className="model-input">
                                    <label>导弹模型</label>
                                    <input
                                        type="file"
                                        accept=".glb,.gltf"
                                        onChange={e =>
                                            handleFileChange(
                                                config.id,
                                                "missileModel",
                                                e
                                            )
                                        }
                                        style={{ display: "none" }}
                                        id={`missile-model-${config.id}`}
                                    />
                                    <label
                                        htmlFor={`missile-model-${config.id}`}
                                        className="file-input-label"
                                    >
                                        {config.missileModelFile
                                            ? config.missileModelFile.name
                                            : "选择文件"}
                                    </label>
                                </div>
                            </div>
                            <div className="trajectory-input">
                                <label>轨迹文件</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={e =>
                                        handleFileChange(
                                            config.id,
                                            "trajectory",
                                            e
                                        )
                                    }
                                    style={{ display: "none" }}
                                    id={`trajectory-${config.id}`}
                                />
                                <label
                                    htmlFor={`trajectory-${config.id}`}
                                    className="file-input-label"
                                >
                                    {config.trajectoryFile
                                        ? config.trajectoryFile.name
                                        : "选择文件"}
                                </label>
                            </div>
                            {configs.length > 1 && (
                                <button
                                    className="remove-btn"
                                    onClick={() => removeConfig(config.id)}
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button className="add-config-btn" onClick={addConfig}>
                    继续添加配置
                </button>

                <div className="modal-actions">
                    <button className="confirm-btn" onClick={handleConfirm}>
                        确认
                    </button>
                    <button className="cancel-btn" onClick={onClose}>
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimulationConfigModal;
