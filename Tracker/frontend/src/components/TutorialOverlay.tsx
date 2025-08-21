import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle, SkipForward } from 'lucide-react';
import { Tutorial, TutorialStep } from '@/types/onboarding';

interface TutorialOverlayProps {
  tutorial: Tutorial;
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
  currentStepIndex?: number;
  onStepChange?: (stepIndex: number) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  tutorial,
  isVisible,
  onComplete,
  onSkip,
  onClose,
  currentStepIndex = 0,
  onStepChange
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(currentStepIndex);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = tutorial.steps[activeStepIndex];
  const isLastStep = activeStepIndex === tutorial.steps.length - 1;

  // Update highlight position when step changes
  useEffect(() => {
    if (!isVisible || !currentStep?.target) return;

    const updateHighlight = () => {
      const targetElement = document.querySelector(currentStep.target!);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setHighlightRect(rect);
        
        // Scroll target into view if needed
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      } else {
        setHighlightRect(null);
      }
    };

    // Initial highlight
    setTimeout(updateHighlight, 100);

    // Update on resize and scroll
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [isVisible, currentStep, activeStepIndex]);

  // Validate step completion
  useEffect(() => {
    if (!currentStep?.validationFn) {
      setIsValidated(true);
      return;
    }

    const checkValidation = async () => {
      try {
        const result = await currentStep.validationFn!();
        setIsValidated(result);
      } catch (error) {
        console.error('Step validation error:', error);
        setIsValidated(false);
      }
    };

    checkValidation();

    // Check validation on DOM changes
    const observer = new MutationObserver(checkValidation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-*']
    });

    return () => observer.disconnect();
  }, [currentStep]);

  const handleNext = async () => {
    if (currentStep?.actionButton) {
      try {
        await currentStep.actionButton.action();
      } catch (error) {
        console.error('Step action error:', error);
        return;
      }
    }

    if (isLastStep) {
      onComplete();
    } else {
      const nextIndex = activeStepIndex + 1;
      setActiveStepIndex(nextIndex);
      onStepChange?.(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (activeStepIndex > 0) {
      const prevIndex = activeStepIndex - 1;
      setActiveStepIndex(prevIndex);
      onStepChange?.(prevIndex);
    }
  };

  const handleSkip = () => {
    if (currentStep?.skippable !== false) {
      onSkip();
    }
  };

  const getTooltipPosition = (): React.CSSProperties => {
    if (!highlightRect || !tooltipRef.current) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let top = 0;
    let left = 0;
    let transform = '';

    const position = currentStep.position || 'bottom';
    const padding = 20;

    switch (position) {
      case 'top':
        top = highlightRect.top - tooltipRect.height - padding;
        left = highlightRect.left + highlightRect.width / 2;
        transform = 'translateX(-50%)';
        break;
      case 'bottom':
        top = highlightRect.bottom + padding;
        left = highlightRect.left + highlightRect.width / 2;
        transform = 'translateX(-50%)';
        break;
      case 'left':
        top = highlightRect.top + highlightRect.height / 2;
        left = highlightRect.left - tooltipRect.width - padding;
        transform = 'translateY(-50%)';
        break;
      case 'right':
        top = highlightRect.top + highlightRect.height / 2;
        left = highlightRect.right + padding;
        transform = 'translateY(-50%)';
        break;
    }

    // Ensure tooltip stays within viewport
    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewport.width - padding) {
      left = viewport.width - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewport.height - padding) {
      top = viewport.height - tooltipRect.height - padding;
    }

    return { top, left, transform };
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay Background */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      >
        {/* Highlight Cutout */}
        {highlightRect && (
          <div
            className="absolute border-4 border-blue-500 rounded-lg shadow-lg bg-transparent"
            style={{
              top: highlightRect.top - 4,
              left: highlightRect.left - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Tutorial Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute bg-white rounded-xl shadow-2xl p-6 max-w-md border border-gray-200"
          style={getTooltipPosition()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {currentStep.title}
              </h3>
              <p className="text-sm text-gray-600">
                Step {activeStepIndex + 1} of {tutorial.steps.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((activeStepIndex + 1) / tutorial.steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-700 mb-3">{currentStep.description}</p>
            {typeof currentStep.content === 'string' ? (
              <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: currentStep.content }} />
            ) : (
              currentStep.content
            )}
          </div>

          {/* Validation Status */}
          {currentStep.validationFn && (
            <div className="mb-4 flex items-center">
              {isValidated ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm">Step completed!</span>
                </div>
              ) : (
                <div className="flex items-center text-amber-600">
                  <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Complete the action above to continue</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {activeStepIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
              )}
              
              {currentStep.skippable !== false && (
                <button
                  onClick={handleSkip}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <SkipForward className="w-4 h-4 mr-1" />
                  Skip Tutorial
                </button>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={currentStep.validationFn && !isValidated}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {currentStep.actionButton?.text || (isLastStep ? 'Complete' : 'Next')}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TutorialOverlay;
