import * as React from 'react';

import { IComponentProps } from '../token';

export interface IErrorProps extends IComponentProps {
  errorMessage: string;
}

const ErrorIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width="18" 
    height="18" 
    fill="currentColor"
  >
    <path fill="none" d="M0 0h24v24H0z"/>
    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
  </svg>
);

export const ErrorMessage: React.FC<IErrorProps> = ({
  errorMessage
}) => {
  return (
    <div className="jp-ai-error-message">
       <div className="jp-ai-error-icon">
         <ErrorIcon />
       </div>
       <div className="jp-ai-error-body">
         <div className="jp-ai-error-title">Error</div>
         <div className="jp-ai-error-text">{errorMessage}</div>
       </div>
    </div>
  );
};
