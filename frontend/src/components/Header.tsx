import React from 'react';
import { ChevronDown, CircleHelp, Cloud, Plane, Plus, Sparkles } from 'lucide-react';

interface HeaderProps {
  onTriggerRun: () => void;
  isTriggering: boolean;
  totalCurated: number;
  activeNiche: string;
}

export const Header: React.FC<HeaderProps> = ({
  onTriggerRun,
  isTriggering,
  totalCurated,
  activeNiche,
}) => {
  const readableNiche = activeNiche.replace(/_/g, ' ');

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><Plane size={19} /></div>
        <div className="brand-name">Aviation<span>Cura</span></div>
        <div className="header-divider" />
        <button className="project-switcher" type="button" aria-label="Current workspace">
          <span>Flight Deck</span><ChevronDown size={14} />
        </button>
      </div>

      <div className="header-center">
        <div className="system-status">
          <span className="signal-dot" />
          <span>All systems nominal</span>
        </div>
        <span className="header-context">{totalCurated} exports</span>
      </div>

      <div className="header-actions">
        <div className="niche-context"><Cloud size={15} /><span>{readableNiche}</span></div>
        <button type="button" className="icon-header-button" aria-label="Help"><CircleHelp size={18} /></button>
        <button
          type="button"
          onClick={onTriggerRun}
          disabled={isTriggering}
          className="new-run-button"
        >
          {isTriggering ? <Sparkles size={16} className="spin-icon" /> : <Plus size={17} />}
          <span>{isTriggering ? 'Building library' : 'New curation run'}</span>
        </button>
      </div>
    </header>
  );
};
