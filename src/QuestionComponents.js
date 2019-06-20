import React, { Component } from "react";
import {
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  FormText,
  ButtonGroup
} from "reactstrap";

// export class QuestionStatus extends Component{
//     constructor(props) {
//         super(props);
//         this.state = {
//             status: props.status
//         };
//     }

//     render(){
//         return <div>{this.state.status}</div>;
//     }
// }

export class Votes extends Component {
  constructor(props) {
    super(props);
    this.handleMessage = this.handleMessage.bind(this);
    this.state = {
      votes: props.votes
    };
  }

  handleMessage(topic, message) {
    const m = JSON.parse(String(message));
    switch (m.path) {
      case "upvotequestion":
        if (m.data.questionId === this.props.questionId) {
          this.setState({
            votes: m.data.votes
          });
        }
        break;
      default:
        break;
    }
  }

  componentDidMount() {
    this.props.client.on("message", this.handleMessage);
  }

  componentWillUnmount() {
    this.props.client.removeListener("message", this.handleMessage);
  }

  render() {
    return <div>{this.state.votes}</div>;
  }
}

export class ActionMenu extends Component {
  constructor(props) {
    super(props);
    this.approve = this.approve.bind(this);
    this.reject = this.reject.bind(this);
    this.delete = this.delete.bind(this);
    this.publish = this.publish.bind(this);
  }

  render() {
    const row = this.props.row;
    switch (row.status) {
      case "pending":
        return (
          <span>
            <Button color="link" onClick={() => this.approve(row.questionId)}>
              Approve
            </Button>
            <Button color="link" onClick={() => this.reject(row.questionId)}>
              Reject
            </Button>
          </span>
        );
      case "approved":
        return (
          <span>
            <Button color="link" onClick={() => this.publish(row.questionId)}>
              Publish
            </Button>
            <Button color="link" onClick={() => this.delete(row.questionId)}>
              Delete
            </Button>
          </span>
        );
      case "published":
        return (
          <span>
            <Button color="link" onClick={() => this.publish(row.questionId)}>
              Unpublish
            </Button>
            <Button color="link" onClick={() => this.delete(row.questionId)}>
              Answered
            </Button>
          </span>
        );
      case "deleted":
      case "rejected":
        return (
          <span>
            <Button color="link" onClick={() => this.approve(row.questionId)}>
              Re-Approve
            </Button>
          </span>
        );
      default:
        return null;
    }
  }

  approve(questionId) {
    this.props.updateQuestion(
      "approvequestion",
      this.props.sessionId,
      questionId
    );
  }

  reject(questionId) {
    this.props.updateQuestion(
      "rejectquestion",
      this.props.sessionId,
      questionId
    );
  }

  delete(questionId) {
    this.props.updateQuestion(
      "deletequestion",
      this.props.sessionId,
      questionId
    );
  }

  publish(questionId) {
    this.props.updateQuestion(
      "publishquestion",
      this.props.sessionId,
      questionId
    );
  }
}
