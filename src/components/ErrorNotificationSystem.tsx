/**
 * Error Notification System
 * 
 * This component provides a comprehensive notification system for displaying
 * error messages, warnings, and recovery options to users. It integrates with
 * the error handler service to provide real-time feedback.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { ErrorNotification, errorHandlerService } from '@/services/errorHandlerService';
import { cn } from '@/lib/utils';

interface NotificationSystemProps {
  /** Maximum number of notifications to show at once */
  maxNotifications?: number;
  /** Position of notifications on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Whether to show animations */
  animated?: boolean;
  /** Custom className for the container */
  className?: string;
}

/**
 * Individual notification component
 */
const NotificationItem: React.FC<{
  notification: ErrorNotification;
  onDismiss: (id: string) => void;
  animated?: boolean;
}> = ({ notification, onDismiss, animated = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-close if specified
    if (notification.autoClose && notification.duration) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
      
      return () => clearTimeout(timer);
    }
  }, [notification.autoClose, notification.duration]);

  const handleDismiss = useCallback(() => {
    if (animated) {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    } else {
      onDismiss(notification.id);
    }
  }, [notification.id, onDismiss, animated]);

  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getAlertVariant = () => {
    switch (notification.type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <div
      className={cn(
        'transition-all duration-300 ease-in-out',
        animated && !isVisible && 'opacity-0 transform translate-x-full',
        animated && isVisible && !isExiting && 'opacity-100 transform translate-x-0',
        animated && isExiting && 'opacity-0 transform translate-x-full scale-95'
      )}
    >
      <Alert variant={getAlertVariant()} className="relative pr-12 shadow-lg border">
        {getIcon()}
        
        {/* Dismiss button */}
        {!notification.persistent && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        <div className="space-y-2">
          <AlertTitle className="text-sm font-medium">
            {notification.title}
          </AlertTitle>
          
          <AlertDescription className="text-sm">
            {notification.message}
          </AlertDescription>

          {/* Action buttons */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant === 'primary' ? 'default' : 
                          action.variant === 'destructive' ? 'destructive' : 'outline'}
                  onClick={async () => {
                    try {
                      await action.action();
                    } catch (error) {
                      console.error('Error executing notification action:', error);
                    }
                  }}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar for auto-close notifications */}
        {notification.autoClose && notification.duration && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b">
            <div
              className={cn(
                'h-full rounded-b transition-all ease-linear',
                notification.type === 'error' ? 'bg-red-500' :
                notification.type === 'warning' ? 'bg-yellow-500' :
                notification.type === 'info' ? 'bg-blue-500' : 'bg-green-500'
              )}
              style={{
                animation: `shrink ${notification.duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </Alert>
    </div>
  );
};

/**
 * Main notification system component
 */
export const ErrorNotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  position = 'top-right',
  animated = true,
  className,
}) => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);

  useEffect(() => {
    // Subscribe to notifications from the error handler service
    const unsubscribe = errorHandlerService.onNotification((notification) => {
      setNotifications(prev => {
        // Remove any existing notification with the same ID
        const filtered = prev.filter(n => n.id !== notification.id);
        
        // Add the new notification
        const updated = [...filtered, notification];
        
        // Limit the number of notifications
        if (updated.length > maxNotifications) {
          return updated.slice(-maxNotifications);
        }
        
        return updated;
      });
    });

    return unsubscribe;
  }, [maxNotifications]);

  const handleDismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      {/* CSS for progress bar animation */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <div
        className={cn(
          'fixed z-50 w-full max-w-sm space-y-3 pointer-events-none',
          getPositionClasses(),
          className
        )}
      >
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem
              notification={notification}
              onDismiss={handleDismiss}
              animated={animated}
            />
          </div>
        ))}
      </div>
    </>
  );
};

/**
 * Hook for manually triggering notifications
 */
export const useNotifications = () => {
  const showNotification = useCallback((notification: Omit<ErrorNotification, 'id'>) => {
    const fullNotification: ErrorNotification = {
      id: crypto.randomUUID(),
      ...notification,
    };

    // This would need to be implemented to manually trigger notifications
    // For now, we'll just log it as the service handles notifications internally
    console.log('Manual notification triggered:', fullNotification);
  }, []);

  const showError = useCallback((title: string, message: string, actions?: ErrorNotification['actions']) => {
    showNotification({
      type: 'error',
      title,
      message,
      actions,
      autoClose: false,
    });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message: string, actions?: ErrorNotification['actions']) => {
    showNotification({
      type: 'warning',
      title,
      message,
      actions,
      autoClose: true,
      duration: 8000,
    });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message: string, actions?: ErrorNotification['actions']) => {
    showNotification({
      type: 'info',
      title,
      message,
      actions,
      autoClose: true,
      duration: 5000,
    });
  }, [showNotification]);

  const showSuccess = useCallback((title: string, message: string) => {
    showNotification({
      type: 'info',
      title,
      message,
      autoClose: true,
      duration: 3000,
    });
  }, [showNotification]);

  return {
    showNotification,
    showError,
    showWarning,
    showInfo,
    showSuccess,
  };
};

/**
 * Provider component that includes the notification system
 */
export const ErrorNotificationProvider: React.FC<{
  children: React.ReactNode;
  notificationProps?: NotificationSystemProps;
}> = ({ children, notificationProps }) => {
  return (
    <>
      {children}
      <ErrorNotificationSystem {...notificationProps} />
    </>
  );
};

export default ErrorNotificationSystem;