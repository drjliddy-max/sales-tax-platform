import { Tutorial, OnboardingProgress, POSOnboardingContext } from '@/types/onboarding';

class OnboardingService {
  private baseUrl = '/api/onboarding';

  /**
   * Get user's onboarding progress
   */
  async getProgress(): Promise<OnboardingProgress> {
    try {
      const response = await fetch(`${this.baseUrl}/progress`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }

      const data = await response.json();
      return {
        ...data,
        currentTutorial: data.currentTutorial ? {
          ...data.currentTutorial,
          startedAt: new Date(data.currentTutorial.startedAt)
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching onboarding progress:', error);
      // Return default progress if API fails
      return {
        userId: '',
        completedTutorials: [],
        skippedTutorials: [],
        totalProgressPercentage: 0
      };
    }
  }

  /**
   * Get available tutorials
   */
  async getTutorials(category?: string): Promise<Tutorial[]> {
    try {
      const url = category 
        ? `${this.baseUrl}/tutorials?category=${category}`
        : `${this.baseUrl}/tutorials`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tutorials');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      return [];
    }
  }

  /**
   * Start a tutorial
   */
  async startTutorial(tutorialId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/${tutorialId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start tutorial');
      }
    } catch (error) {
      console.error('Error starting tutorial:', error);
      throw error;
    }
  }

  /**
   * Update tutorial progress
   */
  async updateProgress(tutorialId: string, stepIndex: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/${tutorialId}/progress`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stepIndex })
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }
    } catch (error) {
      console.error('Error updating tutorial progress:', error);
    }
  }

  /**
   * Complete a tutorial
   */
  async completeTutorial(tutorialId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/${tutorialId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to complete tutorial');
      }
    } catch (error) {
      console.error('Error completing tutorial:', error);
      throw error;
    }
  }

  /**
   * Skip a tutorial
   */
  async skipTutorial(tutorialId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/${tutorialId}/skip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to skip tutorial');
      }
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  }

  /**
   * Save POS onboarding context
   */
  async savePOSContext(context: POSOnboardingContext): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/pos-context`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(context)
      });

      if (!response.ok) {
        throw new Error('Failed to save POS context');
      }
    } catch (error) {
      console.error('Error saving POS context:', error);
    }
  }

  /**
   * Get personalized tutorials based on user context
   */
  async getPersonalizedTutorials(context?: POSOnboardingContext): Promise<Tutorial[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/personalized`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(context || {})
      });

      if (!response.ok) {
        throw new Error('Failed to fetch personalized tutorials');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching personalized tutorials:', error);
      return [];
    }
  }

  /**
   * Get tutorial by ID
   */
  async getTutorial(tutorialId: string): Promise<Tutorial | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tutorials/${tutorialId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch tutorial');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching tutorial:', error);
      return null;
    }
  }

  /**
   * Reset all tutorial progress (for development/testing)
   */
  async resetProgress(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/progress/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset progress');
      }
    } catch (error) {
      console.error('Error resetting progress:', error);
      throw error;
    }
  }
}

export const onboardingService = new OnboardingService();
