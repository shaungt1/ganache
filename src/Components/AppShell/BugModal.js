import React, { Component } from 'react'

import { dismissSystemError } from '../../Actions/Core'

import connect from '../Helpers/connect'

import Modal from '../../Elements/Modal'

import BugIcon from '../../Elements/icons/errorant.svg'

import { sanitizeError, sanitizePaths } from '../Helpers/sanitize.js'

import { shell } from 'electron'

import OnlyIf from '../../Elements/OnlyIf';

const { app, getCurrentWebContents } = require('electron').remote

class BugModal extends Component {
  constructor () {
    super()
    this.scrollDedupeTimeout = null
  }

  // grabs the last 500 log lines as a string formatted for inclusion as a github issue
  renderAndSanitizeLogLines () {
    let result = ''
    if (this.props.logs && this.props.logs.lines && this.props.logs.lines.length > 0) {
      let maxLines = -175 // negative because Array.slice -- we want the last 175 lines, not the first 175

      // GitHub has a max URL length of ~8KiB, so we truncate logs to fit within that
      while (encodeURIComponent(result = _getLastNLogLines(maxLines, this.props.logs)).length > 7500) {
        maxLines++ // reduces number of lines we get next time
      }
    }
    return sanitizePaths(result)
  }

  renderIssueBody(sanitizedSystemError, sanitizedLogLines) {
    let issueBody =
      "<!-- Please give us as much detail as you can about what you were doing at the time of the error, and any other relevant information -->\n" +
      "\n" +
      "\n" +
      `PLATFORM: ${process.platform}\n` +
      `GANACHE VERSION: ${app.getVersion()}\n` +
      "\n" +
      "EXCEPTION:\n" +
      "```\n" +
      `${sanitizedSystemError}\n` +
      "```"

    if (sanitizedLogLines) {
      issueBody += "\n" +
        "\n" +
        "APPLICATION LOG:\n" +
        "```\n" +
        `${sanitizedLogLines}\n` +
        "```"
    }
    return encodeURIComponent(issueBody).replace(/%09/g, '')
  }

  render () {
    // in the future we can use the info on the systemError object to implement
    // a feature which searches for existing github issues rather than always
    // submitting a new one

    let unsanitizedSystemError = this.props.systemError.stack || this.props.systemError
    let sanitizedSystemError = ''
    let sanitizedLogLines = ''

    if (unsanitizedSystemError) {
      sanitizedSystemError = sanitizeError(unsanitizedSystemError)
      sanitizedLogLines = this.renderAndSanitizeLogLines()
    }

    let knownError = false;
    let title = `Uh Oh... That's a bug.`
    let mainMessage = {__html: `Ganache encountered an error. Help us fix it by raising a GitHub issue!
      <br /><br />Mention the following error information when writing your ticket, and please include as
      much information as possible. Sorry about that!`}

    if ("code" in this.props.systemError) {
      switch (this.props.systemError.code) {
        case "EADDRINUSE":
          knownError = true
          title = `Uh Oh... We Couldn't Start the RPC Server`
          mainMessage = {__html: `Ganache had issues starting the RPC server with the network interface
            and port settings you used.<br /><br />Please make sure you don't have multiple instances of
            Ganache running or have any other processes running on the same port.<br /><br />You can see
            the detailed error below:`}
          break;
        default:
          break;
      }
    }

    return (
      <Modal className="BugModal">
        <section className="Bug">
          <OnlyIf test={!knownError}>
            <BugIcon /*size={192}*/ />
          </OnlyIf>
          <h4>{title}</h4>
          <p dangerouslySetInnerHTML={mainMessage}>
          </p>
          <textarea disabled={true} value={sanitizedSystemError} />
          <footer>
            <OnlyIf test={!knownError}>
              <button
                onClick={() => {
                  const title = encodeURIComponent(
                    `System Error when running Ganache ${app.getVersion()} on ${process.platform}`
                  )

                  const body = this.renderIssueBody(sanitizedSystemError, sanitizedLogLines)

                  shell.openExternal(
                    `https://github.com/trufflesuite/ganache/issues/new?title=${title}&body=${body}`
                  )
                }}
              >
                Raise Github Issue
              </button>
            </OnlyIf>
            <button
              onClick={() => {
                getCurrentWebContents().send('navigate', '/config/false')
                this.props.dispatch(dismissSystemError())
              }}
            >
              OPEN SETTINGS
            </button>
            <button
              onClick={() => {
                app.relaunch()
                app.exit()
              }}
            >
              RELAUNCH
            </button>
          </footer>
        </section>
      </Modal>
    )
  }
}

function _getLastNLogLines(maxLines, logs) {
  let firstLogTime = logs.lines[0].time.getTime()
  return logs.lines
    .slice(maxLines)
    .map(v => `T+${v.time.getTime() - firstLogTime}ms: ${v.line}`)
    .join('\n')
}


export default connect(BugModal)
