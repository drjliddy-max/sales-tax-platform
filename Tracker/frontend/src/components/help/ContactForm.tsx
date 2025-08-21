import React, { useState } from 'react';
import { Send, Mail, User, MessageSquare, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    page?: string;
    userRole?: string;
    additionalInfo?: Record<string, any>;
  };
  initialSubject?: string;
  initialCategory?: string;
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
  includeContext: boolean;
}

const CONTACT_CATEGORIES = [
  { id: 'general', label: 'General Question', icon: 'MessageSquare' },
  { id: 'technical', label: 'Technical Support', icon: 'AlertCircle' },
  { id: 'billing', label: 'Billing & Account', icon: 'User' },
  { id: 'integration', label: 'POS Integration', icon: 'Link' },
  { id: 'compliance', label: 'Tax Compliance', icon: 'Shield' },
  { id: 'feature', label: 'Feature Request', icon: 'Lightbulb' },
  { id: 'bug', label: 'Bug Report', icon: 'Bug' },
  { id: 'other', label: 'Other', icon: 'HelpCircle' }
];

const PRIORITY_LEVELS = [
  { id: 'low', label: 'Low - General inquiry', color: 'text-green-600' },
  { id: 'normal', label: 'Normal - Standard support', color: 'text-blue-600' },
  { id: 'high', label: 'High - Business impacting', color: 'text-orange-600' },
  { id: 'urgent', label: 'Urgent - System down', color: 'text-red-600' }
];

export default function ContactForm({ isOpen, onClose, context, initialSubject = '', initialCategory = 'general' }: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: initialSubject,
    category: initialCategory,
    priority: 'normal',
    message: '',
    includeContext: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const generateContextInfo = () => {
    if (!context || !formData.includeContext) return '';

    const contextInfo = [
      '\n\n--- Technical Context ---',
      `Page: ${context.page || 'Unknown'}`,
      `User Role: ${context.userRole || 'Not specified'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      `Screen Resolution: ${window.screen.width}x${window.screen.height}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`
    ];

    if (context.additionalInfo) {
      contextInfo.push(`Additional Info: ${JSON.stringify(context.additionalInfo, null, 2)}`);
    }

    return contextInfo.join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Prepare email content
      const emailContent = {
        to: 'info@salestaxbot.com',
        from: formData.email,
        replyTo: formData.email,
        subject: `[${formData.category.toUpperCase()}] ${formData.subject}`,
        body: `
Name: ${formData.name}
Email: ${formData.email}
Category: ${CONTACT_CATEGORIES.find(cat => cat.id === formData.category)?.label}
Priority: ${PRIORITY_LEVELS.find(p => p.id === formData.priority)?.label}

Message:
${formData.message}

${generateContextInfo()}
        `.trim()
      };

      // In a real application, you would send this to your backend API
      // For now, we'll simulate the email sending
      console.log('Sending email:', emailContent);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demonstration, we'll create a mailto link as fallback
      const mailtoLink = `mailto:info@salestaxbot.com?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
      
      // Try to open the user's email client
      window.location.href = mailtoLink;

      setSubmitStatus('success');
      
      // Reset form after success
      setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          subject: '',
          category: 'general',
          priority: 'normal',
          message: '',
          includeContext: true
        });
        onClose();
      }, 3000);

    } catch (error) {
      console.error('Error sending contact form:', error);
      setSubmitStatus('error');
      setErrorMessage('Failed to send message. Please try again or email us directly at info@salestaxbot.com');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.subject.trim() && formData.message.trim();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Contact Support</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your full name"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your.email@example.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                {CONTACT_CATEGORIES.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                {PRIORITY_LEVELS.map(priority => (
                  <option key={priority.id} value={priority.id}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              required
              value={formData.subject}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of your question or issue"
              disabled={isSubmitting}
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              value={formData.message}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              placeholder="Please describe your question or issue in detail. Include any error messages, steps to reproduce, or additional context that might be helpful."
              disabled={isSubmitting}
            />
          </div>

          {/* Include Context */}
          {context && (
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="includeContext"
                name="includeContext"
                checked={formData.includeContext}
                onChange={handleInputChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <div>
                <label htmlFor="includeContext" className="text-sm font-medium text-gray-700">
                  Include technical context
                </label>
                <p className="text-sm text-gray-500">
                  This helps our support team understand your environment and provide better assistance.
                </p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {submitStatus === 'success' && (
            <div className="flex items-center space-x-2 p-4 bg-green-50 text-green-800 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Message sent successfully!</p>
                <p className="text-sm">We'll respond to your inquiry within 24 hours.</p>
              </div>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="flex items-start space-x-2 p-4 bg-red-50 text-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">Failed to send message</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              <p>We typically respond within 24 hours</p>
              <p>For urgent issues, call: <span className="font-medium">1-800-SALES-TAX</span></p>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Direct Contact Info */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Other Ways to Reach Us</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium">Email</p>
              <a href="mailto:info@salestaxbot.com" className="text-blue-600 hover:underline">
                info@salestaxbot.com
              </a>
            </div>
            <div>
              <p className="font-medium">Support Hours</p>
              <p>Mon-Fri: 9AM-6PM EST</p>
            </div>
            <div>
              <p className="font-medium">Documentation</p>
              <button 
                onClick={onClose}
                className="text-blue-600 hover:underline"
              >
                Browse Help Center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
