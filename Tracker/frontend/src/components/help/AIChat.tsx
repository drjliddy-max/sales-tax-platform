import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, MessageCircle, ExternalLink } from 'lucide-react';
import { ChatMessage } from '@/types';
import { helpContentService } from '@/services/HelpContentService';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    page?: string;
    userRole?: string;
    additionalInfo?: Record<string, any>;
  };
}

// Enhanced AI Response Generator with live help content
const generateAIResponse = async (userMessage: string): Promise<string> => {
  const message = userMessage.toLowerCase();
  
  // Try to find relevant help articles first
  try {
    const relevantArticles = await helpContentService.searchAllCategories(userMessage);
    
    if (relevantArticles.length > 0) {
      const topArticle = relevantArticles[0];
      const additionalArticles = relevantArticles.slice(1, 3);
      
      let response = `I found some helpful resources for your question:\n\n`;
      response += `**${topArticle.title}**\n${topArticle.description}\n\n`;
      
      if (additionalArticles.length > 0) {
        response += `**Related Articles:**\n`;
        additionalArticles.forEach(article => {
          response += `• ${article.title}\n`;
        });
        response += `\n`;
      }
      
      // Add personalized advice based on the topic
      if (message.includes('getting started') || message.includes('setup')) {
        response += `💡 **Quick Start Tip:** Visit our Help Center for step-by-step guides and click on the "Getting Started" category for comprehensive setup instructions.\n\n`;
      } else if (message.includes('integration') || message.includes('pos')) {
        response += `🔗 **Integration Help:** Our live content crawler finds the latest integration guides from official POS providers. Check the "Integrations" section for up-to-date documentation.\n\n`;
      } else if (message.includes('tax rate') || message.includes('calculation')) {
        response += `📊 **Tax Rate Updates:** Our system crawls government websites daily for the latest tax rate changes. Visit the "Tax Rates & Compliance" section for current information.\n\n`;
      }
      
      response += `Would you like me to help you with any specific aspect of this topic?`;
      return response;
    }
  } catch (error) {
    console.error('Error searching help articles:', error);
  }
  
  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return "Hello! I'm here to help you with Sales Tax Insights. I can assist with setup, POS integrations, tax calculations, compliance, and reporting. What would you like to know?";
  }
  
  if (message.includes('setup') || message.includes('getting started')) {
    return "To get started:\n\n1. Complete your business profile\n2. Add your business details and nexus states\n3. Configure tax settings\n4. Connect your POS system or import data\n5. Run a test transaction\n\nWould you like help with any specific step?";
  }
  
  if (message.includes('pos') || message.includes('integration')) {
    return "We support hundreds of POS systems through our universal integration platform:\n\n**Popular Systems:**\n• Square, Shopify, Clover, Toast, WooCommerce\n• PayPal, Stripe, QuickBooks POS\n• Lightspeed, Revel, TouchBistro\n• And many more!\n\n**Don't see your POS?** No problem! Our platform connects to ANY system with:\n• Direct API integration\n• Secure OAuth login to your account\n• Real-time transaction sync\n• Custom integration setup\n\n**To connect ANY POS:**\n1. Go to Settings → Integrations\n2. Click 'Add New Integration'\n3. Search for your system or select 'Other'\n4. Log into your POS account securely\n5. Authorize the connection\n6. Start syncing transactions automatically\n\nWhat POS system are you looking to connect?";
  }
  
  if (message.includes('paypal') || message.includes('stripe') || message.includes('not in the list') || message.includes('not listed')) {
    return "Great question! Even if your POS system isn't in our featured list, we can still connect to it:\n\n**For PayPal, Stripe, and other payment processors:**\n1. Go to Settings → Integrations\n2. Click 'Add Custom Integration'\n3. Select your platform (PayPal/Stripe/Other)\n4. **Secure Login**: You'll log into YOUR account directly\n5. **OAuth Authorization**: Grant permission for transaction access\n6. **Automatic Sync**: Transactions flow in real-time\n\n**Why this works:**\n• We use industry-standard OAuth (same as logging into Google/Facebook)\n• Your credentials stay with your POS provider\n• We only access transaction data you approve\n• Works with virtually any system with an API\n\n**Need help with a specific POS?** Just tell me which one and I'll walk you through the exact steps!";
  }
  
  if (message.includes('tax') && (message.includes('rate') || message.includes('calculation'))) {
    return "Our tax calculations are 99.9% accurate with:\n\n• Daily rate updates from government sources\n• Real-time calculations\n• State-specific rules automatically applied\n• Multi-jurisdiction support\n\nWe handle complex scenarios like exemptions, special districts, and product-specific rates.";
  }
  
  if (message.includes('report') || message.includes('analytics')) {
    return "You can generate various reports:\n\n• Sales tax returns by state\n• Transaction summaries\n• Business analytics\n• Compliance reports\n\nReports can be exported as PDF, Excel, or CSV. Go to Reports section to get started!";
  }
  
  if (message.includes('help') || message.includes('support') || message.includes('content') || message.includes('crawler') || message.includes('firecrawl')) {
    return "I'm here to help! You can:\n\n• Ask me questions about any feature\n• Get step-by-step guidance\n• Find relevant help articles\n• Contact our support team\n• **NEW**: Visit our Content Crawler at /content-crawler for real-time tax information\n\n**Dynamic Content Features:**\n• Live tax rates from government sites\n• Updated filing requirements\n• Latest POS integration guides\n• Fresh industry help articles\n\nPowered by Firecrawl v2 for always up-to-date information!\n\nWhat specific topic would you like help with?";
  }
  
  if (message.includes('oauth') || message.includes('login') || message.includes('connect') || message.includes('authorize')) {
    return "Our secure OAuth integration process:\n\n**How it works:**\n1. **You stay in control**: Log into YOUR account on your POS provider's secure site\n2. **Permission-based**: You choose exactly what data to share\n3. **Industry standard**: Same technology used by Google, Facebook, etc.\n4. **Secure**: We never see your login credentials\n5. **Revocable**: You can disconnect anytime from your POS settings\n\n**During connection:**\n• You'll be redirected to your POS provider's login page\n• Log in with your existing credentials\n• Grant permission for transaction data access\n• Return to our platform with secure connection established\n\n**What we access:**\n• Transaction data only (amounts, dates, taxes)\n• NO payment details or customer info\n• Only what's needed for tax calculations\n\nThis ensures your security while enabling seamless tax management!";
  }
  
  if (message.includes('custom') || message.includes('api') || message.includes('not supported')) {
    return "We can integrate with virtually any POS system through custom API connections:\n\n**Custom Integration Process:**\n1. **System Analysis**: We review your POS capabilities\n2. **API Documentation**: Work with your system's API specs\n3. **Secure Connection**: Establish OAuth or API key authentication\n4. **Data Mapping**: Map your transaction fields to our system\n5. **Testing**: Verify data accuracy and sync reliability\n6. **Go Live**: Start automatic transaction importing\n\n**Timeline**: Usually 1-3 business days for standard APIs\n\n**What you need:**\n• API access to your POS system\n• Transaction data export capabilities\n• Basic system information\n\n**We've successfully integrated:**\n• Restaurant systems, retail POS, e-commerce platforms\n• Payment processors, mobile card readers\n• Industry-specific systems (medical, automotive, etc.)\n\nWhat POS system are you looking to connect?";
  }
  
  // Default response
  return "I can help you with:\n\n• Account setup and configuration\n• POS system integrations (including custom systems)\n• Tax calculations and compliance\n• OAuth connections and security\n• Generating reports and analytics\n• Troubleshooting issues\n\nCould you tell me more about what you're trying to do?";
};

export default function AIChat({ isOpen, onClose, context }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hi! I'm your Sales Tax AI assistant with access to live help content. I can help with setup, POS integrations, tax calculations, reporting, and more. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // Simulate thinking delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const aiResponse = await generateAIResponse(currentMessage);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: "Sorry, I'm having trouble right now. Please try again or contact support.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    "How do I set up my account?",
    "What POS systems do you support?", 
    "How do tax rate calculations work?",
    "Help with sales tax reporting",
    "Integration troubleshooting guide"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 z-[60] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <div className="flex items-center space-x-2">
              <p className="text-xs text-gray-600">Sales Tax Help</p>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600 font-medium">Live Content</span>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex space-x-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'user' ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-3 h-3 text-white" />
                ) : (
                  <Bot className="w-3 h-3 text-gray-600" />
                )}
              </div>
              <div className={`rounded-lg p-3 ${
                message.type === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="text-sm whitespace-pre-line">{message.content}</div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex space-x-2 max-w-[80%]">
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3 text-gray-600" />
              </div>
              <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="text-xs text-gray-600 mb-2">Try asking:</div>
          <div className="space-y-1">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(question)}
                className="block w-full text-left text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}