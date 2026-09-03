import React from 'react';

interface Props {
    projectModel: any;
}

export function SSOTUI({ projectModel }: Props) {
    const handleCopy = () => {
        if (projectModel) {
            const jsonString = JSON.stringify(projectModel.serialize ? projectModel.serialize() : projectModel.toJSON(), null, 2);
            navigator.clipboard.writeText(jsonString);
            alert('Skopiowano JSON projektu (SSOT) do schowka!');
        }
    };

    return (
        <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
            <button 
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '10px', justifyContent: 'center' }}
                onClick={handleCopy}
            >
                Kopiuj do schowka
            </button>
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#18181b', borderRadius: '4px', padding: '10px', border: '1px solid #27272a' }}>
                <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', color: '#34d399', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {projectModel ? JSON.stringify(projectModel.serialize ? projectModel.serialize() : projectModel.toJSON(), null, 2) : '{}'}
                </pre>
            </div>
        </div>
    );
}
