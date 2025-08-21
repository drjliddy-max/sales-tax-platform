export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode | string;
  target?: string; // CSS selector for highlighting element
  position?: 'top' | 'bottom' | 'left' | 'right';
  skippable?: boolean;
  actionButton?: {
    text: string;
    action: () => void | Promise<void>;
  };
  validationFn?: () => boolean | Promise<boolean>;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'pos_integration' | 'dashboard' | 'reports' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // in minutes
  prerequisites?: string[];
  steps: TutorialStep[];
  completionReward?: {
    type: 'badge' | 'feature_unlock' | 'discount';
    value: string;
  };
}

export interface OnboardingProgress {
  userId: string;
  completedTutorials: string[];
  currentTutorial?: {
    tutorialId: string;
    currentStepIndex: number;
    startedAt: Date;
  };
  skippedTutorials: string[];
  totalProgressPercentage: number;
}

export interface POSOnboardingContext {
  selectedPOSType?: string;
  hasExistingCredentials?: boolean;
  businessType?: string;
  primaryUseCase?: string;
  technicalSkillLevel?: 'beginner' | 'intermediate' | 'expert';
}

export interface OnboardingTooltip {
  id: string;
  title: string;
  content: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
  trigger?: 'hover' | 'click' | 'focus' | 'auto';
  delay?: number;
}
