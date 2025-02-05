import { useState, useRef, useEffect } from 'react'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'
import { cn } from '@/lib/utils'
import { useSubBlockValue } from '../hooks/use-sub-block-value'
import { TagDropdown, checkTagTrigger } from '@/components/ui/tag-dropdown'

interface CodeProps {
  blockId: string
  subBlockId: string
  isConnecting: boolean
}

export function Code({ blockId, subBlockId, isConnecting }: CodeProps) {
  const [storeValue, setStoreValue] = useSubBlockValue(blockId, subBlockId)
  const [code, setCode] = useState('')
  const [lineCount, setLineCount] = useState(1)
  const [showTags, setShowTags] = useState(false)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [activeSourceBlockId, setActiveSourceBlockId] = useState<string | null>(
    null
  )
  const editorRef = useRef<HTMLDivElement>(null)

  // Add new state for tracking visual line heights
  const [visualLineHeights, setVisualLineHeights] = useState<number[]>([])

  // Sync code with store value on initial load and when store value changes
  useEffect(() => {
    if (storeValue !== null) {
      setCode(storeValue.toString())
    }
  }, [storeValue])

  // Update the line counting logic to account for wrapped lines
  useEffect(() => {
    if (!editorRef.current) return

    const calculateVisualLines = () => {
      const preElement = editorRef.current?.querySelector('pre')
      if (!preElement) return

      const lines = code.split('\n')
      const newVisualLineHeights: number[] = []

      // Create a temporary span to measure text
      const measureSpan = document.createElement('span')
      measureSpan.style.visibility = 'hidden'
      measureSpan.style.position = 'absolute'
      measureSpan.style.whiteSpace = 'pre-wrap'
      measureSpan.style.width = `${preElement.clientWidth - 24}px` // Subtract padding
      measureSpan.style.font = window.getComputedStyle(preElement).font
      document.body.appendChild(measureSpan)

      lines.forEach((line) => {
        measureSpan.textContent = line || ' '
        const height = Math.ceil(measureSpan.offsetHeight / 21) // 21px is our line height
        newVisualLineHeights.push(height)
      })

      document.body.removeChild(measureSpan)
      setVisualLineHeights(newVisualLineHeights)

      // Calculate total visual lines for line numbers
      const totalVisualLines = newVisualLineHeights.reduce(
        (sum, height) => sum + height,
        0
      )
      setLineCount(totalVisualLines)
    }

    calculateVisualLines()

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateVisualLines)
    resizeObserver.observe(editorRef.current)

    return () => resizeObserver.disconnect()
  }, [code])

  // Modify the line numbers rendering to account for wrapped lines
  const renderLineNumbers = () => {
    const numbers: JSX.Element[] = []
    let lineNumber = 1

    visualLineHeights.forEach((height) => {
      for (let i = 0; i < height; i++) {
        numbers.push(
          <div
            key={`${lineNumber}-${i}`}
            className={cn(
              'text-xs text-muted-foreground leading-[21px]',
              // Only show number on first line of wrapped content
              i > 0 && 'invisible'
            )}
          >
            {lineNumber}
          </div>
        )
      }
      lineNumber++
    })

    return numbers
  }

  // Handle drops from connection blocks
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type !== 'connectionBlock') return

      // Get current cursor position from the textarea
      const textarea = editorRef.current?.querySelector('textarea')
      const dropPosition = textarea?.selectionStart ?? code.length

      // Insert '<' at drop position to trigger the dropdown
      const newValue =
        code.slice(0, dropPosition) + '<' + code.slice(dropPosition)

      setCode(newValue)
      setStoreValue(newValue)
      setCursorPosition(dropPosition + 1)
      setShowTags(true)

      if (data.connectionData?.sourceBlockId) {
        setActiveSourceBlockId(data.connectionData.sourceBlockId)
      }

      // Set cursor position after state updates
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = dropPosition + 1
          textarea.selectionEnd = dropPosition + 1
          textarea.focus()
        }
      }, 0)
    } catch (error) {
      console.error('Failed to parse drop data:', error)
    }
  }

  // Handle tag selection
  const handleTagSelect = (newValue: string) => {
    setCode(newValue)
    setStoreValue(newValue)
    setShowTags(false)
    setActiveSourceBlockId(null)
  }

  return (
    <div
      className={cn(
        'font-mono text-sm border rounded-md overflow-visible relative',
        'bg-background text-muted-foreground',
        isConnecting && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Updated line numbers */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[30px] bg-muted/30 flex flex-col items-end pr-3 pt-3 select-none"
        aria-hidden="true"
      >
        {renderLineNumbers()}
      </div>

      <div ref={editorRef} className="pl-[30px] pt-0 mt-0 relative">
        <Editor
          value={code}
          onValueChange={(newCode) => {
            setCode(newCode)
            setStoreValue(newCode)

            // Check for tag trigger
            const textarea = editorRef.current?.querySelector('textarea')
            if (textarea) {
              const pos = textarea.selectionStart
              setCursorPosition(pos)
              const trigger = checkTagTrigger(newCode, pos)
              setShowTags(trigger.show)
              if (!trigger.show) {
                setActiveSourceBlockId(null)
              }
            }
          }}
          highlight={(code) =>
            highlight(code, languages.javascript, 'javascript')
          }
          padding={12}
          style={{
            fontFamily: 'inherit',
            minHeight: '46px',
            lineHeight: '21px',
          }}
          className="focus:outline-none"
          textareaClassName="focus:outline-none focus:ring-0 bg-transparent"
        />

        {showTags && (
          <TagDropdown
            visible={showTags}
            onSelect={handleTagSelect}
            blockId={blockId}
            activeSourceBlockId={activeSourceBlockId}
            inputValue={code}
            cursorPosition={cursorPosition}
            onClose={() => {
              setShowTags(false)
              setActiveSourceBlockId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
