import { Pause, Play } from "lucide-react";
import icon from "../icon.png";

interface TopPillProps {
    onQuit: () => void;
    isPaused?: boolean;
    onPauseToggle?: () => void;
}

export default function TopPill({
    onQuit,
    isPaused = false,
    onPauseToggle,
}: TopPillProps) {
    return (
        <div className="flex justify-center mt-2 select-none z-50">
            <div
                className="
          draggable-area
          flex items-center gap-2
          rounded-full
          glass-panel
          shadow-lg shadow-black/20
          pl-1.5 pr-1.5 py-1.5
          transition-all duration-300 ease-sculpted
          hover:shadow-xl
        "
            >
                {/* LOGO BUTTON */}
                <button
                    className="
            w-8 h-8
            rounded-full
            bg-glass-bg-light
            flex items-center justify-center
            relative overflow-hidden
            interaction-base interaction-press
            hover:bg-glass-bg-light
          "
                >
                    <img
                        src={icon}
                        alt="Smarter.li"
                        className="w-[24px] h-[24px] object-contain opacity-90 scale-105"
                        draggable="false"
                        onDragStart={(e) => e.preventDefault()}
                    />
                </button>

                {/* PAUSE / RESUME BUTTON */}
                {onPauseToggle && (
                    <button
                        onClick={onPauseToggle}
                        className={`
              w-8 h-8
              rounded-full
              flex items-center justify-center
              interaction-base interaction-press
              ${isPaused
                                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                                : 'bg-glass-bg-light text-text-secondary hover:bg-white/10 hover:text-text-primary'
                            }
            `}
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? (
                            <>
                                <Play className="w-3.5 h-3.5" />
                                {/* Amber pulsing indicator */}
                                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            </>
                        ) : (
                            <Pause className="w-3.5 h-3.5" />
                        )}
                    </button>
                )}

                {/* STOP / QUIT BUTTON */}
                <button
                    onClick={onQuit}
                    className="
            w-8 h-8
            rounded-full
            bg-glass-bg-light
            flex items-center justify-center
            text-text-secondary
            interaction-base interaction-press
            hover:bg-red-500/10 hover:text-red-400
          "
                >
                    <div className="w-3.5 h-3.5 rounded-[3px] bg-current opacity-80" />
                </button>
            </div>
        </div>
    );
}
