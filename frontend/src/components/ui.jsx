import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export const Button = React.forwardRef(({ className = '', variant = 'primary', ...props }, ref) => {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`; // primary, secondary, outline
  return (
    <button
      ref={ref}
      className={`${baseClass} ${variantClass} ${className}`}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export const Input = React.forwardRef(({ className = '', label, id, ...props }, ref) => {
  return (
    <div className="input-wrapper" style={{ marginBottom: '16px' }}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`input-base ${className}`}
        {...props}
      />
    </div>
  );
});
Input.displayName = 'Input';

export const Select = React.forwardRef(({ className = '', label, id, options = [], ...props }, ref) => {
  return (
    <div className="select-wrapper" style={{ marginBottom: '16px' }}>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <select
        ref={ref}
        id={id}
        className={`input-base ${className}`}
        style={{ appearance: 'auto' }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});
Select.displayName = 'Select';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`card-header ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`card-title ${className}`} {...props}>
    {children}
  </h3>
);

export const Badge = ({ className = '', variant = 'primary', children, ...props }) => {
  const variantClass = variant === 'primary' ? 'badge' : `badge-${variant}`;
  return (
    <span className={`${variantClass} ${className}`} {...props}>
      {children}
    </span>
  );
};

export const Tabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="tabs-container">
      <div className="tabs-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-trigger ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tabs.find(t => t.id === activeTab)?.content}
      </div>
    </div>
  );
};

export const LoadingState = ({ title = "Loading...", description = "Please wait while we process the data." }) => (
  <div className="state-container">
    <Loader2 className="state-icon spinner" size={32} />
    <h3 className="state-title">{title}</h3>
    <p className="state-description">{description}</p>
  </div>
);

export const ErrorState = ({ title = "Something went wrong", description = "An error occurred while fetching the data." }) => (
  <div className="state-container state-error">
    <AlertCircle className="state-icon" size={32} />
    <h3 className="state-title">{title}</h3>
    <p className="state-description">{description}</p>
  </div>
);

export const EmptyState = ({ title = "No Data Available", description = "There is no data to display for the selected parameters." }) => (
  <div className="state-container">
    <Inbox className="state-icon" size={32} />
    <h3 className="state-title">{title}</h3>
    <p className="state-description">{description}</p>
  </div>
);
