import * as React from 'react';

import { IComponentProps } from '../token';

export interface IErrorProps extends IComponentProps {
  errorMessage: string;
}

export const ErrorMessage: React.FC<IErrorProps> = ({
  errorMessage
}) => {
  return (
    <div className="jp-ai-error-message">
       <span className="jp-ai-error-icon">⚠️</span>
       <span className="jp-ai-error-text">{errorMessage}</span>
    </div>
  );
};
