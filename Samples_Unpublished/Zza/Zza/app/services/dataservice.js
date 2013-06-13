﻿(function () {
    'use strict';
    angular.module('app').factory('dataservice',
    
    ['breeze', 'model', 'config', 'logger',
    function (breeze, model, config, logger) {
                
        var EntityQuery = breeze.EntityQuery,
            manager;
        
        configureBreeze();

        var dataservice = {
            getAllCustomers: getAllCustomers,
            getCustomerPage: getCustomerPage,
            getOrders: getOrders,
            createCustomer: createCustomer
        };
        return dataservice;

        //#region main application operations

        function getAllCustomers() {
            var query = EntityQuery
                .from("Customers")
                .orderBy("CompanyName");

            return manager.executeQuery(query);
        }

        function getCustomerPage(skip, take, searchText) {
            var query = breeze.EntityQuery
                .from("Customers")
                .orderBy("CompanyName")
                .skip(skip).take(take);
            if (searchText) {
                query = query.where("CompanyName", "contains", searchText);
            }

            return manager.executeQuery(query);
        }

        function getOrders(customer) {
            return customer.entityAspect.loadNavigationProperty("Orders");
        }

        function createCustomer() {
            return manager.createEntity("Customer");
        }

        function saveChanges(suppressLogIfNothingToSave) {
            if (manager.hasChanges()) {
                if (_isSaving) {
                    setTimeout(saveChanges, 50);
                    return;
                }
                _isSaving = true;
                manager.saveChanges()
                    .then(saveSucceeded)
                    .fail(saveFailed)
                    .fin(saveFinished);
            } else if (!suppressLogIfNothingToSave) {
                logger.info("Nothing to save");
            }
            ;
        }

        function saveSucceeded(saveResult) {
            logger.success("# of Todos saved = " + saveResult.entities.length);
            logger.log(saveResult);
        }

        function saveFailed(error) {
            var reason = error.message;
            var detail = error.detail;

            if (reason === "Validation error") {
                handleSaveValidationError(error);
                return;
            }
            if (detail && detail.ExceptionType &&
                detail.ExceptionType.indexOf('OptimisticConcurrencyException') !== -1) {
                // Concurrency error 
                reason =
                    "Another user, perhaps the server, may have deleted one or all of the todos.";
                manager.rejectChanges(); // DEMO ONLY: discard all pending changes
            }

            logger.error(error,
                "Failed to save changes. " + reason +
                    " You may have to restart the app.");
        }

        function saveFinished() { _isSaving = false; }

        function handleSaveValidationError(error) {
            var message = "Not saved due to validation error";
            try { // fish out the first error
                var firstErr = error.entitiesWithErrors[0].entityAspect.getValidationErrors()[0];
                message += ": " + firstErr.errorMessage;
            } catch(e) { /* eat it for now */
            }
            logger.error(message);
        }
        
        function configureBreeze() {
            breeze.config.initializeAdapterInstance("modelLibrary", "backingStore", true);
            breeze.NamingConvention.camelCase.setAsDefault();
            
            var serviceName = config.serviceName; 
            manager = new breeze.EntityManager(serviceName);
            manager.enableSaveQueuing(true);
            model.configureMetadataStore(manager.metadataStore);
            return manager;
        }
        //#endregion
    }]);

})();