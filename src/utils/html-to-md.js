/**
 * src/utils/html-to-md.js
 * Responsibilities: A lightweight, generic HTML to GitHub Flavored Markdown (GFM) converter.
 * It contains NO LeetCode-specific logic and is built entirely on native DOM parsing.
 */
class HtmlToMd {
  /**
   * Converts an HTML string or DOM node to Markdown.
   * @param {string|Node} html - The input HTML.
   * @returns {string} - The generated Markdown.
   */
  static convert(html) {
    if (!html) return '';
    
    let root;
    if (typeof html === 'string') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      root = doc.body;
    } else {
      root = html;
    }

    return this._processNode(root).trim();
  }

  static _processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Collapse sequential whitespace in standard HTML text nodes
      return node.textContent.replace(/\s+/g, ' '); 
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tagName = node.tagName.toLowerCase();

    // Handle children recursively
    const processChildren = () => {
      let childMd = '';
      node.childNodes.forEach(child => {
        childMd += this._processNode(child);
      });
      return childMd;
    };

    switch (tagName) {
      case 'h1': return `\n# ${processChildren().trim()}\n\n`;
      case 'h2': return `\n## ${processChildren().trim()}\n\n`;
      case 'h3': return `\n### ${processChildren().trim()}\n\n`;
      case 'h4': return `\n#### ${processChildren().trim()}\n\n`;
      case 'h5': return `\n##### ${processChildren().trim()}\n\n`;
      case 'h6': return `\n###### ${processChildren().trim()}\n\n`;
      
      case 'p': 
      case 'div': 
        return `\n${processChildren().trim()}\n\n`;
        
      case 'br': 
        return `\n`;
        
      case 'strong':
      case 'b': 
        return `**${processChildren().trim()}**`;
        
      case 'em':
      case 'i': 
        return `*${processChildren().trim()}*`;
        
      case 'code': 
        return `\`${processChildren().trim()}\``;
        
      case 'pre': 
        // Fenced code block (preserve exact formatting, no recursive parsing)
        return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
        
      case 'ul': 
      case 'ol':
        return `\n${processChildren()}\n`;
        
      case 'li': 
        const isOrdered = node.parentNode && node.parentNode.tagName.toLowerCase() === 'ol';
        const prefix = isOrdered ? '1. ' : '- ';
        return `${prefix}${processChildren().trim()}\n`;
        
      case 'a':
        const href = node.getAttribute('href') || '';
        return `[${processChildren().trim()}](${href})`;
        
      case 'img':
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        return `![${alt}](${src})`;
        
      case 'table':
        return `\n${this._processTable(node)}\n\n`;
        
      case 'span':
      case 'body':
      default:
        return processChildren();
    }
  }

  static _processTable(tableNode) {
    let md = '';
    const rows = tableNode.querySelectorAll('tr');
    
    rows.forEach((row, rowIndex) => {
      let rowMd = '|';
      const cells = row.querySelectorAll('th, td');
      
      if (cells.length === 0) return;
      
      cells.forEach(cell => {
        rowMd += ` ${this._processNode(cell).replace(/\n/g, ' ').trim()} |`;
      });
      
      md += `${rowMd}\n`;
      
      if (rowIndex === 0) {
        let separator = '|';
        cells.forEach(() => { separator += '---|'; });
        md += `${separator}\n`;
      }
    });
    
    return md;
  }
}

if (typeof window !== 'undefined') {
  window.HtmlToMd = HtmlToMd;
}
