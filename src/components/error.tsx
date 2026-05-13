import * as React from 'react';

import { IComponentProps } from '../token';
import { errorIcon } from '../icons';

export interface IErrorProps extends IComponentProps {
  errorMessage: string;
  title?: string;
}

export const ErrorMessage: React.FC<IErrorProps> = ({
  errorMessage,
  title = 'Error'
}) => {
  return (
    <div className="jp-ai-error-message">
      <div className="jp-ai-error-icon">
        <errorIcon.react tag="span" width="18px" height="18px" />
      </div>
      <div className="jp-ai-error-body">
        <div className="jp-ai-error-title">{title}</div>
        <div className="jp-ai-error-text">{errorMessage}</div>
      </div>
    </div>
  );
};
