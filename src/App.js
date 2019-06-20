import React, { Component } from "react";
import { Button, FormGroup, Label, Input, ButtonGroup } from "reactstrap";

//MQTT (AWS IOT)
import uuidv4 from "uuid/v4";
import AWS from "aws-sdk/global";
import AWSMqttClient from "aws-mqtt";

//HTTP Requests
import request from "request-promise-native";

//Bootstrap Table (For demo display)
import BootstrapTable from "react-bootstrap-table-next";
import filterFactory, { selectFilter } from "react-bootstrap-table2-filter";
import paginationFactory from "react-bootstrap-table2-paginator";
import "./App.css";
import { sortCaret } from "./common.js";

import { Votes, ActionMenu } from "./QuestionComponents.js";
import pwc_logo from "./images/logo.png";

//Environment Configs
import { IdentityPoolId, apiEndpoint, iotEndpoint, region } from "./configs.js";
AWS.config.region = region;
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: IdentityPoolId
});

//Connect to AWS IOT
const client = new AWSMqttClient({
  region: AWS.config.region,
  credentials: AWS.config.credentials,
  endpoint: iotEndpoint,
  clientId: uuidv4()
});

client.on("connect", () => {
  logToPage("Successfully connected to AWS MQTT Broker!  :-)");
});

client.on("close", () => {
  logToPage("Closed  :-(");
});

client.on("offline", () => {
  logToPage("Went offline  :-(");
});

var logger;
function logToPage(data) {
  if (logger !== undefined) {
    logger(data);
  } else {
    console.log(data);
  }
}

const questions = {};

function updateQuestion(path, sessionId, questionId) {
  request({
    method: "POST",
    uri: apiEndpoint + path,
    body: {
      sessionId: sessionId,
      questionId: questionId
    },
    json: true // Automatically stringifies the body to JSON
  })
    .then(result => {
      logToPage(path + " " + questionId + " Success");
    })
    .catch(err => {
      logToPage(err);
    });
}

const statusFilter = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
  deleted: "Deleted"
};

class App extends Component {
  constructor(props) {
    super(props);
    this.logToPage = this.logToPage.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.upsertQuestions = this.upsertQuestions.bind(this);
    this.sessionId = "2";

    this.state = {
      questions: [],
      logs: ""
    };
    this.columns = [
      {
        dataField: "questionId",
        hidden: true,
        text: "questionId"
      },
      {
        dataField: "username",
        headerStyle: { width: "10%" },
        text: "User Name"
      },
      {
        dataField: "question",
        text: "Question",
        headerStyle: { width: "50%" }
      },
      {
        dataField: "votes",
        sort: true,
        sortCaret: sortCaret,
        headerStyle: { width: "10%" },
        text: "Votes",
        formatter: (cell, row, rowIndex, formatExtraData) => {
          return (
            <Votes questionId={row.questionId} votes={cell} client={client} />
          );
        }
      },
      {
        dataField: "createdAt",
        headerStyle: { width: "10%" },
        sort: true,
        sortCaret: sortCaret,
        text: "Created At",
        formatter: (cell, row, rowIndex, formatExtraData) => {
          return new Date(cell).toString();
        }
      },
      {
        dataField: "status",
        headerStyle: { width: "10%" },
        sort: true,
        sortCaret: sortCaret,
        text: "Status",
        // formatter: (cell, row, rowIndex, formatExtraData) =>{
        //     return <QuestionStatus questionId={row.questionId} status={cell}/>;
        // },
        filter: selectFilter({
          options: statusFilter,
          withoutEmptyOption: true,
          style: { display: "none" },
          onFilter: filterVal =>
            this.setState({ filter: statusFilter[filterVal] }),
          getFilter: filter => (this.changeStatusFilter = filter)
        })
      },
      {
        dataField: "dummy1",
        isDummyField: true,
        text: "Actions",
        headerStyle: { width: "10%" },
        editable: false,
        formatter: (cell, row, rowIndex, formatExtraData) => {
          return (
            <ActionMenu
              row={row}
              updateQuestion={updateQuestion}
              sessionId={this.sessionId}
            />
          );
        }
      }
    ];
  }

  logToPage(str) {
    this.logs.unshift(str);
    this.setState({
      logs: this.logs.join("\n")
    });
  }

  componentDidMount() {
    client.on("message", this.handleMessage);
    this.subscribe();
  }

  handleMessage(topic, message) {
    const m = JSON.parse(String(message));
    switch (m.path) {
      case "submitquestion":
      case "approvequestion":
      case "rejectquestion":
      case "publishquestion":
      case "deletequestion":
        this.upsertQuestions([m.data]);
        break;
      default:
        break;
    }
  }

  componentWillUnmount() {
    client.end();
  }

  subscribe() {
    request({
      method: "POST",
      uri: apiEndpoint + "getallquestions",
      body: {
        sessionId: this.sessionId
      },
      json: true // Automatically stringifies the body to JSON
    })
      .then(result => {
        client.subscribe(this.sessionId + "/moderator", {}, (err, granted) => {
          if (err) {
            logToPage(err);
          } else {
            granted.forEach(({ topic, qos }) => {
              logToPage("Subscribed to: " + topic + " at Qos: " + qos);
            });
            client.subscribe(this.sessionId + "/clients", (err, granted) => {
              if (err) {
                logToPage(err);
              } else {
                granted.forEach(({ topic, qos }) => {
                  logToPage("Subscribed to: " + topic + " at Qos: " + qos);
                });
                this.upsertQuestions(result);
                this.setState({ joined: true });
              }
            });
          }
        });
      })
      .catch(err => {
        console.log(err);
      });
  }

  upsertQuestions(qArr) {
    qArr.forEach(val => {
      questions[val.questionId] = val;
    });
    this.setState({
      questions: Object.values(questions)
    });
  }

  render() {
    return (
      <div className="moderator-dashboard">
        <header>
          <img src={pwc_logo} alt="pwc-logo" />
          <div class="vertical-bar" />
          <div class="heading-title">CaTSH Partner Conference 2019</div>
        </header>

        {this.renderQuestions()}
      </div>
    );
  }

  renderQuestions() {
    return (
      <div className="box">
        <div className="left-box">{this.renderFilterButtons()}</div>
        <div className="right-box">
          <div className="right-box-static-content">
            <div className="total-box">Total</div>{" "}
            <div className="total-count">
              {this.state.questions.length}{" "}
              <span className="total-text">Posts</span>
            </div>
          </div>
          <BootstrapTable
            keyField="questionId"
            data={this.state.questions}
            columns={this.columns}
            pagination={paginationFactory()}
            defaultSorted={[{ dataField: "createdAt", order: "asc" }]}
            noDataIndication="Table is Empty"
            filter={filterFactory()}
          />
        </div>
      </div>
    );
  }

  renderFilterButtons() {
    return Object.entries(statusFilter).map(([key, value]) => {
      const color = this.state.filter === value ? "tab active" : "tab";
      return (
        <Button
          key={value}
          color={color}
          onClick={() => this.changeStatusFilter(key)}
        >
          {value}
        </Button>
      );
    });
  }
}

export default App;
