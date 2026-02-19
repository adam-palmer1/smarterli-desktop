import React from 'react';

interface GeneralSettingsProps { }

export const GeneralSettings: React.FC<GeneralSettingsProps> = () => {
    return (
        <div className="space-y-8 animated fadeIn">
            <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">General Configuration</h3>
                <p className="text-xs text-text-secondary mb-4">
                    Speech recognition and language settings are managed by your server.
                    Visit the AI Providers tab to configure your server connection.
                </p>
            </div>
        </div>
    );
};
