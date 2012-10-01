﻿define(function(require) {
    var breeze = require('breeze'),
        core = breeze.core,
        entityModel = breeze.entityModel;

    // Configure for Knockout binding and Web API persistence services
    core.config.setProperties({
        trackingImplementation: entityModel.entityTracking_ko,
        remoteAccessImplementation: entityModel.remoteAccess_webApi
    });

    var op = entityModel.FilterQueryOp,
        manager = new entityModel.EntityManager('api/inspector'),
        answerType, jobType, addressType, inspectionType,
        data,
        forms;

    function executeQuery(query) {
        if (data.isOffline()) {
            return {
                then: function(callback) {
                    callback({ results: manager.executeQueryLocally(query) });
                }
            };
        } else {
            return manager.executeQuery(query);
        }
    }

    function preloadData(def) {
        var query = new entityModel.EntityQuery()
            .from("Forms")
            .expand("Questions");

        answerType = manager.metadataStore.getEntityType("Answer");
        jobType = manager.metadataStore.getEntityType("Job");
        addressType = manager.metadataStore.getEntityType("Address");
        inspectionType = manager.metadataStore.getEntityType("Inspection");

        executeQuery(query).then(function(response) {
            forms = response.results;
            def.resolve();
        });
    }

    data = {
        ready: function() {
            return $.Deferred(function(def) {
                if (data.isOffline()) {
                    preloadData(def);
                } else {
                    manager.fetchMetadata().then(function() {
                        preloadData(def);
                    });
                }
            }).promise();
        },
        getForms: function() {
            return forms;
        },
        getInspectors: function() {
            var query = new entityModel.EntityQuery()
                .from("Inspectors");

            return executeQuery(query);
        },
        getJobsFor: function(inspectorId) {
            var query = new entityModel.EntityQuery()
                .from("Jobs")
                .expand("Location, Inspections.Answers")
                .where("Inspector.Id", op.Equals, inspectorId)
                .orderBy("CreatedAt");

            return executeQuery(query);
        },
        createAnswer: function(inspection, question) {
            var answer = answerType.createEntity();
            answer.Inspection(inspection);
            answer.Question(question);
            return answer;
        },
        createJob: function(inspector) {
            var job = jobType.createEntity();
            job.Inspector(inspector);
            job.CreatedAt(new Date());
            job.Location(addressType.createEntity());
            return job;
        },
        saveJob: function(job) {
            manager.addEntity(job);
            return this.saveChanges();
        },
        createInspection: function(inspectionForm) {
            var inspection = inspectionType.createEntity();
            inspection.Form(inspectionForm);
            inspection.Status("New");
            return inspection;
        },
        saveInspection: function(inspection) {
            manager.addEntity(inspection);
            return this.saveChanges();
        },
        saveChanges: function() {
            if (this.isOffline()) {
                localStorage.setItem("manager", manager.export());
                return {
                    then: function(callback) {
                        callback();
                    }
                };
            }

            return manager.saveChanges();
        },
        isOffline: function() {
            return localStorage.getItem("offline") == "true";
        },
        toggleConnection: function() {
            if (!this.isOffline()) {
                localStorage.setItem("manager", manager.export());
                localStorage.setItem("offline", "true");
            } else {
                localStorage.removeItem("offline");
            }
        }
    };

    if (data.isOffline()) {
        manager.importEntities(localStorage.getItem("manager"));
    }

    return data;
});